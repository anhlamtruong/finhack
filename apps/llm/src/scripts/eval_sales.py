#!/usr/bin/env python3
"""
eval_sales.py — lightweight offline evaluator for the TS sales API.

- Loads a list of test cases (queries + params)
- Calls /v1/sales/search (and optionally /v1/sales/suggest)
- Checks basic invariants (priceMax respected, URL uniqueness, shape sanity, etc.)
- Writes a JSON report you can diff across commits
- Exits non-zero if any case fails (good for CI)

No external dependencies required, stdlib only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import math
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


# -----------------------------
# HTTP helpers (stdlib only)
# -----------------------------
def http_json_post(url: str, payload: Dict[str, Any], timeout: float = 25.0) -> Tuple[int, Dict[str, Any]]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body) if body else {}
            except json.JSONDecodeError:
                return resp.status, {"_raw": body}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            j = json.loads(body) if body else {}
        except json.JSONDecodeError:
            j = {"_raw": body}
        return e.code, j
    except Exception as e:
        # Network / timeout
        return 0, {"error": f"request_failed: {e.__class__.__name__}: {e}"}


def http_json_get(url: str, timeout: float = 10.0) -> Tuple[int, Dict[str, Any]]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body) if body else {}
            except json.JSONDecodeError:
                return resp.status, {"_raw": body}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            j = json.loads(body) if body else {}
        except json.JSONDecodeError:
            j = {"_raw": body}
        return e.code, j
    except Exception as e:
        return 0, {"error": f"request_failed: {e.__class__.__name__}: {e}"}


# -----------------------------
# Eval definitions
# -----------------------------
@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class CaseResult:
    id: str
    endpoint: str
    request: Dict[str, Any]
    status: int
    response_ok: bool
    router_version: Optional[str]
    elapsed_ms: int
    checks: List[CheckResult]
    error: Optional[str] = None


def is_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))


def safe_float(x: Any) -> Optional[float]:
    try:
        n = float(x)
        if math.isfinite(n):
            return n
        return None
    except Exception:
        return None


def ensure(cond: bool, name: str, detail: str = "") -> CheckResult:
    return CheckResult(name=name, ok=bool(cond), detail=detail if not cond else "")


def load_cases(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict) and "cases" in data:
        data = data["cases"]

    if not isinstance(data, list):
        raise ValueError("cases file must be a JSON list or an object with {cases:[...]}")

    out: List[Dict[str, Any]] = []
    for i, c in enumerate(data):
        if not isinstance(c, dict):
            raise ValueError(f"case index {i} must be an object")
        out.append(c)
    return out


def default_cases() -> List[Dict[str, Any]]:
    # You can edit these quickly without a file.
    return [
        {
            "id": "ping",
            "method": "GET",
            "path": "/v1/sales/ping",
            "timeoutMs": 10_000,
        },
        {
            "id": "search_women",
            "method": "POST",
            "path": "/v1/sales/search",
            "timeoutMs": 25_000,
            "body": {
                "query": "period day kit",
                "womenFocus": True,
                "maxResults": 12,
                "gl": "us",
                "hl": "en",
            },
        },
        {
            "id": "search_plain",
            "method": "POST",
            "path": "/v1/sales/search",
            "timeoutMs": 25_000,
            "body": {
                "query": "Always pads size 2",
                "womenFocus": False,
                "maxResults": 12,
                "gl": "us",
                "hl": "en",
            },
        },
        {
            "id": "search_price_cap",
            "method": "POST",
            "path": "/v1/sales/search",
            "timeoutMs": 25_000,
            "body": {
                "query": "period day kit",
                "womenFocus": True,
                "maxResults": 12,
                "priceMax": 40,
                "gl": "us",
                "hl": "en",
            },
        },
        {
            "id": "suggest_selfcare",
            "method": "POST",
            "path": "/v1/sales/suggest",
            "timeoutMs": 15_000,
            "body": {"goal": "selfcare", "budgetMax": 60},
        },
    ]


# -----------------------------
# Invariant checks for /search
# -----------------------------
def check_search_invariants(req_body: Dict[str, Any], resp: Dict[str, Any]) -> List[CheckResult]:
    checks: List[CheckResult] = []

    checks.append(ensure(resp.get("ok") is True, "ok_true"))
    checks.append(ensure(isinstance(resp.get("items"), list), "items_array"))

    items = resp.get("items") if isinstance(resp.get("items"), list) else []
    max_results = req_body.get("maxResults")
    if is_number(max_results):
        checks.append(ensure(len(items) <= int(max_results), "count<=maxResults",
                             f"got {len(items)} > maxResults {int(max_results)}"))

    # Titles + URLs present
    missing = 0
    for it in items:
        if not isinstance(it, dict):
            missing += 1
            continue
        if not (isinstance(it.get("title"), str) and it["title"].strip()):
            missing += 1
        if not (isinstance(it.get("url"), str) and it["url"].strip()):
            missing += 1
    checks.append(ensure(missing == 0, "items_have_title_url", f"{missing} items missing title/url"))

    # URL uniqueness
    urls: List[str] = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("url"), str):
            urls.append(it["url"])
    dup_count = len(urls) - len(set(urls))
    checks.append(ensure(dup_count == 0, "no_duplicate_urls", f"{dup_count} duplicate urls"))

    # priceMax respected (only for items where price is numeric)
    price_max = req_body.get("priceMax")
    if is_number(price_max):
        pm = float(price_max)
        viol = 0
        viol_examples: List[float] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            p = safe_float(it.get("price"))
            if p is None:
                continue
            if p > pm + 1e-9:
                viol += 1
                if len(viol_examples) < 5:
                    viol_examples.append(p)
        checks.append(
            ensure(
                viol == 0,
                "priceMax_respected",
                f"{viol} items exceed priceMax={pm}. examples={viol_examples}",
            )
        )

    # priceMin respected
    price_min = req_body.get("priceMin")
    if is_number(price_min):
        pn = float(price_min)
        viol = 0
        viol_examples: List[float] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            p = safe_float(it.get("price"))
            if p is None:
                continue
            if p < pn - 1e-9:
                viol += 1
                if len(viol_examples) < 5:
                    viol_examples.append(p)
        checks.append(
            ensure(
                viol == 0,
                "priceMin_respected",
                f"{viol} items below priceMin={pn}. examples={viol_examples}",
            )
        )

    # Optional: withReasons (only if your API attaches `reason` field)
    if req_body.get("withReasons") is True:
        missing_reason = 0
        for it in items:
            if not isinstance(it, dict):
                continue
            r = it.get("reason")
            if not (isinstance(r, str) and r.strip()):
                missing_reason += 1
        # Don’t force all items if you cap reasons; but require at least 1 reason if any items exist.
        if len(items) > 0:
            checks.append(ensure(missing_reason < len(items), "at_least_one_reason",
                                 "no reasons attached to any items"))
        else:
            checks.append(ensure(True, "at_least_one_reason"))

    return checks


def check_suggest_invariants(req_body: Dict[str, Any], resp: Dict[str, Any]) -> List[CheckResult]:
    checks: List[CheckResult] = []
    checks.append(ensure(resp.get("ok") is True, "ok_true"))
    checks.append(ensure(isinstance(resp.get("suggestions"), list), "suggestions_array"))

    sugg = resp.get("suggestions") if isinstance(resp.get("suggestions"), list) else []
    nonempty = [s for s in sugg if isinstance(s, str) and s.strip()]
    checks.append(ensure(len(nonempty) == len(sugg), "suggestions_nonempty", "some suggestions are empty/non-strings"))
    checks.append(ensure(len(sugg) >= 5, "suggestions_count>=5", f"only {len(sugg)} suggestions"))

    # Should mention budget if budgetMax provided
    b = req_body.get("budgetMax")
    if is_number(b):
        token = f"under ${int(float(b))}"
        has = any(isinstance(s, str) and token in s for s in sugg)
        checks.append(ensure(has, "budget_included", f"expected token '{token}' in at least one suggestion"))

    return checks


# -----------------------------
# Runner
# -----------------------------
def run_case(base_url: str, case: Dict[str, Any]) -> CaseResult:
    cid = str(case.get("id") or "case")
    method = (case.get("method") or "POST").upper()
    path = str(case.get("path") or "/v1/sales/search")
    timeout_ms = case.get("timeoutMs") or 25_000
    timeout_s = max(1.0, float(timeout_ms) / 1000.0)

    url = base_url.rstrip("/") + path

    started = time.time()
    status = 0
    resp: Dict[str, Any] = {}
    error: Optional[str] = None

    if method == "GET":
        status, resp = http_json_get(url, timeout=timeout_s)
    else:
        body = case.get("body") or {}
        if not isinstance(body, dict):
            body = {}
        status, resp = http_json_post(url, body, timeout=timeout_s)

    elapsed_ms = int((time.time() - started) * 1000)

    router_version = None
    if isinstance(resp, dict):
        router_version = resp.get("routerVersion") if isinstance(resp.get("routerVersion"), str) else None

    response_ok = bool(isinstance(resp, dict) and resp.get("ok") is True and status in (200, 201))
    if status == 0:
        response_ok = False

    checks: List[CheckResult] = []
    if status == 0:
        error = resp.get("error") if isinstance(resp, dict) else "request_failed"
    elif isinstance(resp, dict) and resp.get("ok") is False:
        error = resp.get("error") if isinstance(resp.get("error"), str) else "api_returned_ok_false"

    # Endpoint-specific checks
    if path.endswith("/sales/search") and isinstance(case.get("body"), dict) and isinstance(resp, dict):
        checks.extend(check_search_invariants(case["body"], resp))
    elif path.endswith("/sales/suggest") and isinstance(case.get("body"), dict) and isinstance(resp, dict):
        checks.extend(check_suggest_invariants(case["body"], resp))
    elif path.endswith("/sales/ping") and isinstance(resp, dict):
        checks.append(ensure(resp.get("ok") is True, "ok_true"))
        checks.append(ensure(resp.get("route") == "sales/ping", "route_is_sales/ping", f"route={resp.get('route')}"))
    else:
        # Generic shape check
        if isinstance(resp, dict):
            checks.append(ensure("ok" in resp, "has_ok_field"))
        else:
            checks.append(ensure(False, "json_response", "response not json dict"))

    # Also require status 2xx for success
    checks.append(ensure(status in (200, 201), "http_2xx", f"status={status}"))

    return CaseResult(
        id=cid,
        endpoint=path,
        request=case.get("body") if isinstance(case.get("body"), dict) else {},
        status=status,
        response_ok=response_ok,
        router_version=router_version,
        elapsed_ms=elapsed_ms,
        checks=checks,
        error=error,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=os.environ.get("SALES_BASE_URL", "http://127.0.0.1:8080"),
                    help="Base URL of the running API server (default: http://127.0.0.1:8080)")
    ap.add_argument("--cases", default=None,
                    help="Path to JSON file of cases. If omitted, uses built-in defaults.")
    ap.add_argument("--out", default="eval_sales_report.json",
                    help="Where to write the report JSON (default: eval_sales_report.json)")
    ap.add_argument("--fail-fast", action="store_true", help="Stop at first failing case")
    args = ap.parse_args()

    # Load cases
    try:
        cases = load_cases(args.cases) if args.cases else default_cases()
    except Exception as e:
        print(f"[eval_sales] failed to load cases: {e}", file=sys.stderr)
        return 2

    results: List[CaseResult] = []
    any_fail = False

    print(f"[eval_sales] base_url={args.base_url} cases={len(cases)} out={args.out}")
    for case in cases:
        res = run_case(args.base_url, case)
        results.append(res)

        ok_checks = all(c.ok for c in res.checks)
        ok = res.response_ok and ok_checks
        status_str = "PASS" if ok else "FAIL"
        print(f"  - {status_str} {res.id} ({res.endpoint}) status={res.status} {res.elapsed_ms}ms"
              f"{'' if not res.router_version else ' rv=' + res.router_version}")

        if not ok:
            any_fail = True
            # Print details
            if res.error:
                print(f"      error: {res.error}")
            for c in res.checks:
                if not c.ok:
                    print(f"      check_failed: {c.name} {('- ' + c.detail) if c.detail else ''}")
            if args.fail_fast:
                break

    report = {
        "generatedAtIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "baseUrl": args.base_url,
        "summary": {
            "cases": len(results),
            "passed": sum(1 for r in results if r.response_ok and all(c.ok for c in r.checks)),
            "failed": sum(1 for r in results if not (r.response_ok and all(c.ok for c in r.checks))),
        },
        "results": [
            {
                **asdict(r),
                "checks": [asdict(c) for c in r.checks],
            }
            for r in results
        ],
    }

    try:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"[eval_sales] wrote {args.out}")
    except Exception as e:
        print(f"[eval_sales] failed to write report: {e}", file=sys.stderr)
        return 2

    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())