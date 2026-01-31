#!/usr/bin/env python3
"""
golden_sales_search.py

"Golden" regression checks for /v1/sales/search that are *stable* against live
provider drift (SerpAPI results change over time). This script focuses on:

- Response contract (shape + required fields)
- Feature invariants (withReasons populates reasons; debug includes querySent; etc.)
- Optional "golden expectations" file that stores only stable, low-entropy signals
  (not the actual retail item list).

 Examples:

  # Run checks and write a report
  python3 apps/llm/src/scripts/golden_sales_search.py \
    --base-url http://127.0.0.1:8080 \
    --out golden_report.json

  # First time: create a golden expectations file
  python3 apps/llm/src/scripts/golden_sales_search.py \
    --base-url http://127.0.0.1:8080 \
    --golden apps/llm/src/scripts/golden_sales_expectations.json \
    --update-golden

  # Later: compare against that golden expectations file
  python3 apps/llm/src/scripts/golden_sales_search.py \
    --base-url http://127.0.0.1:8080 \
    --golden apps/llm/src/scripts/golden_sales_expectations.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

# Prefer httpx (you already use it elsewhere). Fallback to urllib if needed.
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

try:
    from urllib.request import Request, urlopen  # type: ignore
    from urllib.error import URLError, HTTPError  # type: ignore
except Exception:  # pragma: no cover
    Request = None  # type: ignore
    urlopen = None  # type: ignore
    URLError = Exception  # type: ignore
    HTTPError = Exception  # type: ignore


@dataclass
class Case:
    name: str
    payload: Dict[str, Any]
    expect: Dict[str, Any]


DEFAULT_CASES: List[Case] = [
    Case(
        name="women_basic_reasons_debug",
        payload={
            "query": "ramen",
            "womenFocus": True,
            "maxResults": 6,
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
        },
        expect={
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
            "womenFocus": True,
        },
    ),
    Case(
        name="plain_basic_reasons_debug",
        payload={
            "query": "ramen",
            "womenFocus": False,
            "maxResults": 6,
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
        },
        expect={
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
            "womenFocus": False,
        },
    ),
    Case(
        name="price_cap_filters",
        payload={
            "query": "period day kit",
            "womenFocus": True,
            "maxResults": 12,
            "priceMax": 40,
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
            "gl": "us",
            "hl": "en",
        },
        expect={
            "withReasons": True,
            "reasonsMax": 3,
            "debug": True,
            "womenFocus": True,
            "priceMax": 40,
        },
    ),
    Case(
        name="facts_enrichment_all_domains",
        payload={
            "query": "ramen",
            "womenFocus": True,
            "maxResults": 10,
            "withReasons": True,
            "reasonsMax": 3,
            "withFacts": True,
            "factsDomains": ["food", "beauty", "products"],
            "factsPageSize": 12,
            "categoryWeight": 0.35,
            "debug": True,
        },
        expect={
            "withReasons": True,
            "reasonsMax": 3,
            "withFacts": True,
            "factsDomains": ["food", "beauty", "products"],
            "debug": True,
        },
    ),
]


# ----------------------------
# HTTP helpers
# ----------------------------

def _post_json_httpx(url: str, payload: Dict[str, Any], timeout_s: float) -> Tuple[int, Dict[str, Any]]:
    assert httpx is not None
    with httpx.Client(timeout=timeout_s) as client:
        r = client.post(url, json=payload, headers={"Content-Type": "application/json"})
        status = int(r.status_code)
        try:
            data = r.json()
        except Exception:
            raise RuntimeError(f"Non-JSON response from {url}: status={status} body={r.text[:300]!r}")
        return status, data


def _get_json_httpx(url: str, timeout_s: float) -> Tuple[int, Dict[str, Any]]:
    assert httpx is not None
    with httpx.Client(timeout=timeout_s) as client:
        r = client.get(url)
        status = int(r.status_code)
        try:
            data = r.json()
        except Exception:
            raise RuntimeError(f"Non-JSON response from {url}: status={status} body={r.text[:300]!r}")
        return status, data


def _post_json_urllib(url: str, payload: Dict[str, Any], timeout_s: float) -> Tuple[int, Dict[str, Any]]:  # pragma: no cover
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=timeout_s) as resp:
            status = int(getattr(resp, "status", 200))
            raw = resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        status = int(getattr(e, "code", 500))
        raw = e.read().decode("utf-8", errors="replace")
    except URLError as e:
        raise RuntimeError(f"Request failed: {e}") from e

    try:
        data = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"Non-JSON response from {url}: status={status} body={raw[:300]!r}") from e
    return status, data


def _get_json_urllib(url: str, timeout_s: float) -> Tuple[int, Dict[str, Any]]:  # pragma: no cover
    req = Request(url, headers={"Accept": "application/json"}, method="GET")
    try:
        with urlopen(req, timeout=timeout_s) as resp:
            status = int(getattr(resp, "status", 200))
            raw = resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        status = int(getattr(e, "code", 500))
        raw = e.read().decode("utf-8", errors="replace")
    except URLError as e:
        raise RuntimeError(f"Request failed: {e}") from e

    try:
        data = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"Non-JSON response from {url}: status={status} body={raw[:300]!r}") from e
    return status, data


def post_json(url: str, payload: Dict[str, Any], timeout_s: float) -> Tuple[int, Dict[str, Any]]:
    if httpx is not None:
        return _post_json_httpx(url, payload, timeout_s)
    return _post_json_urllib(url, payload, timeout_s)


def get_json(url: str, timeout_s: float) -> Tuple[int, Dict[str, Any]]:
    if httpx is not None:
        return _get_json_httpx(url, timeout_s)
    return _get_json_urllib(url, timeout_s)


# ----------------------------
# Validation helpers
# ----------------------------

def is_nonempty_str(x: Any) -> bool:
    return isinstance(x, str) and x.strip() != ""


def as_list(x: Any) -> List[Any]:
    return x if isinstance(x, list) else []


def validate_item_contract(it: Dict[str, Any], errors: List[str], prefix: str = "") -> None:
    # Required, stable keys
    if not is_nonempty_str(it.get("title")):
        errors.append(f"{prefix}item.title missing/empty")
    if not is_nonempty_str(it.get("url")):
        errors.append(f"{prefix}item.url missing/empty")
    if not is_nonempty_str(it.get("source")):
        errors.append(f"{prefix}item.source missing/empty")

    # Optional but should be sane if present
    for k in ["price", "rating", "reviews"]:
        v = it.get(k, None)
        if v is None:
            continue
        if not isinstance(v, (int, float)):
            errors.append(f"{prefix}item.{k} must be number or null (got {type(v).__name__})")


def validate_debug(debug: Dict[str, Any], errors: List[str], expect_debug: bool) -> None:
    if not expect_debug:
        return
    if not isinstance(debug, dict):
        errors.append("debug missing (expected debug=true)")
        return

    # These are the ones you care about during dev
    # (You had null in your curl output—this catches that.)
    if not is_nonempty_str(debug.get("querySent")):
        errors.append("debug.querySent missing/empty (expected when debug=true)")
    if debug.get("cache") not in ("hit", "miss"):
        # allow null? No—this should be stable.
        errors.append(f"debug.cache must be 'hit' or 'miss' (got {debug.get('cache')!r})")

    # tried should be list (can be empty on cache hit)
    if "tried" in debug and not isinstance(debug.get("tried"), list):
        errors.append("debug.tried must be a list")


def validate_reasons(items: List[Dict[str, Any]], errors: List[str], reasons_max: int) -> None:
    if reasons_max <= 0:
        return
    n = min(len(items), reasons_max)
    for i in range(n):
        r = items[i].get("reason")
        if not is_nonempty_str(r):
            errors.append(f"items[{i}].reason missing/empty (withReasons=true, reasonsMax={reasons_max})")


def validate_price_cap(items: List[Dict[str, Any]], errors: List[str], price_max: Optional[float]) -> None:
    if price_max is None:
        return
    for i, it in enumerate(items):
        p = it.get("price", None)
        if p is None:
            continue
        if isinstance(p, (int, float)) and float(p) > float(price_max) + 1e-9:
            errors.append(f"items[{i}].price={p} exceeds priceMax={price_max}")


def validate_facts_soft(items: List[Dict[str, Any]], errors: List[str]) -> None:
    # "soft" because facts matching is inherently fuzzy and query-dependent.
    # We only enforce: types are correct if present.
    for i, it in enumerate(items):
        cats = it.get("categories", None)
        if cats is None:
            continue
        if not isinstance(cats, list) or not all(isinstance(x, str) for x in cats):
            errors.append(f"items[{i}].categories must be string[] or null")
        bc = it.get("barcode", None)
        if bc is None:
            continue
        if not isinstance(bc, str):
            errors.append(f"items[{i}].barcode must be string or null")


# ----------------------------
# Golden expectations (stable signals)
# ----------------------------

def stable_expectation_from_response(case: Case, resp: Dict[str, Any]) -> Dict[str, Any]:
    items = as_list(resp.get("items"))
    with_reasons = bool(case.expect.get("withReasons", False))
    reasons_max = int(case.expect.get("reasonsMax", 0) or 0)
    n_reason = min(len(items), reasons_max)

    # Only store stable, low-entropy facts
    return {
        "ok": bool(resp.get("ok")),
        "womenFocus": bool(resp.get("womenFocus")),
        "queryUsedPresent": is_nonempty_str(resp.get("queryUsed")),
        "countEqualsItemsLen": (resp.get("count") == len(items)),
        "hasDebug": isinstance(resp.get("debug"), dict),
        "debugHasQuerySent": (isinstance(resp.get("debug"), dict) and is_nonempty_str(resp["debug"].get("querySent"))),
        "debugHasCache": (isinstance(resp.get("debug"), dict) and resp["debug"].get("cache") in ("hit", "miss")),
        "itemsMin1": (len(items) >= 1),
        "itemsAllHaveTitleUrlSource": all(
            is_nonempty_str(it.get("title")) and is_nonempty_str(it.get("url")) and is_nonempty_str(it.get("source"))
            for it in items
            if isinstance(it, dict)
        ),
        "reasonsPresentTopN": (
            (not with_reasons)
            or all(is_nonempty_str(items[i].get("reason")) for i in range(n_reason) if isinstance(items[i], dict))
        ),
        # Soft facts signal: how many items have categories when withFacts=true
        "factsCategoriesCount": sum(1 for it in items if isinstance(it, dict) and isinstance(it.get("categories"), list)),
    }


def compare_expectations(golden: Dict[str, Any], current: Dict[str, Any]) -> List[str]:
    errs: List[str] = []
    for k, gv in golden.items():
        cv = current.get(k, None)
        if gv != cv:
            errs.append(f"Expectation mismatch: {k}: golden={gv!r} current={cv!r}")
    return errs


# ----------------------------
# Main runner
# ----------------------------

def run_case(base_url: str, case: Case, timeout_s: float) -> Dict[str, Any]:
    url = base_url.rstrip("/") + "/v1/sales/search"
    t0 = time.time()
    status, resp = post_json(url, case.payload, timeout_s=timeout_s)
    ms = int((time.time() - t0) * 1000)

    out = {
        "name": case.name,
        "ms": ms,
        "status": status,
        "payload": case.payload,
        "response": resp,
        "errors": [],
    }

    errors: List[str] = []
    if status != 200:
        errors.append(f"HTTP status {status} != 200")

    if not isinstance(resp, dict):
        errors.append("Response is not a JSON object")
        out["errors"] = errors
        return out

    if resp.get("ok") is not True:
        errors.append(f"resp.ok expected true, got {resp.get('ok')!r}")

    items = resp.get("items")
    if not isinstance(items, list):
        errors.append("resp.items missing or not a list")
        items_list: List[Any] = []
    else:
        items_list = items

    # count should match items length
    if "count" in resp and resp.get("count") != len(items_list):
        errors.append(f"resp.count ({resp.get('count')}) != len(items) ({len(items_list)})")

    # Validate each item contract
    for i, it in enumerate(items_list):
        if not isinstance(it, dict):
            errors.append(f"items[{i}] not an object")
            continue
        validate_item_contract(it, errors, prefix=f"items[{i}].")

    # Debug invariants
    expect_debug = bool(case.expect.get("debug", False))
    validate_debug(resp.get("debug") if isinstance(resp.get("debug"), dict) else resp.get("debug"), errors, expect_debug)

    # withReasons invariants
    if bool(case.expect.get("withReasons", False)):
        reasons_max = int(case.expect.get("reasonsMax", 0) or 0)
        dict_items = [it for it in items_list if isinstance(it, dict)]
        validate_reasons(dict_items, errors, reasons_max=reasons_max)

    # price cap invariants (soft but useful)
    if "priceMax" in case.expect:
        dict_items = [it for it in items_list if isinstance(it, dict)]
        validate_price_cap(dict_items, errors, price_max=float(case.expect["priceMax"]))

    # facts invariants (soft typing checks)
    if bool(case.expect.get("withFacts", False)):
        dict_items = [it for it in items_list if isinstance(it, dict)]
        validate_facts_soft(dict_items, errors)

    out["errors"] = errors
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8080", help="API base URL")
    ap.add_argument("--out", default="golden_sales_report.json", help="Write full report JSON here")
    ap.add_argument("--golden", default="", help="Path to golden expectations JSON (stable signals)")
    ap.add_argument("--update-golden", action="store_true", help="Write/update golden expectations file from current run")
    ap.add_argument("--timeout", type=float, default=25.0, help="HTTP timeout seconds")
    ap.add_argument("--no-ping", action="store_true", help="Skip /v1/sales/ping")
    args = ap.parse_args()

    base_url = args.base_url.rstrip("/")
    report: Dict[str, Any] = {
        "base_url": base_url,
        "ts": int(time.time()),
        "ping": None,
        "cases": [],
        "summary": {"passed": 0, "failed": 0},
    }

    # Ping (optional)
    if not args.no_ping:
        try:
            st, pj = get_json(base_url + "/v1/sales/ping", timeout_s=args.timeout)
            report["ping"] = {"status": st, "json": pj}
        except Exception as e:
            report["ping"] = {"error": str(e)}

    # Run cases
    case_results = []
    for case in DEFAULT_CASES:
        res = run_case(base_url, case, timeout_s=args.timeout)
        case_results.append(res)

    # Summarize
    passed = 0
    failed = 0
    for r in case_results:
        if r.get("errors"):
            failed += 1
        else:
            passed += 1

    report["cases"] = case_results
    report["summary"] = {"passed": passed, "failed": failed}

    # Write full report
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Golden expectations logic
    golden_path = args.golden.strip()
    golden_errors: List[str] = []

    if golden_path:
        # Build current expectations
        current_expectations: Dict[str, Any] = {}
        for case, res in zip(DEFAULT_CASES, case_results):
            resp = res.get("response") if isinstance(res.get("response"), dict) else {}
            current_expectations[case.name] = stable_expectation_from_response(case, resp) if isinstance(resp, dict) else {}

        if args.update_golden:
            os.makedirs(os.path.dirname(golden_path) or ".", exist_ok=True)
            with open(golden_path, "w", encoding="utf-8") as f:
                json.dump(
                    {"ts": int(time.time()), "base_url": base_url, "expectations": current_expectations},
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        else:
            # Compare against existing
            try:
                with open(golden_path, "r", encoding="utf-8") as f:
                    g = json.load(f)
                golden_expectations = g.get("expectations", {})
                if not isinstance(golden_expectations, dict):
                    golden_errors.append("Golden file format invalid: expectations must be an object")
                else:
                    for case in DEFAULT_CASES:
                        gexp = golden_expectations.get(case.name, None)
                        cexp = current_expectations.get(case.name, None)
                        if gexp is None:
                            golden_errors.append(f"Golden missing case: {case.name}")
                            continue
                        if not isinstance(gexp, dict) or not isinstance(cexp, dict):
                            golden_errors.append(f"Golden/curr expectations not objects for case: {case.name}")
                            continue
                        golden_errors.extend([f"[{case.name}] {e}" for e in compare_expectations(gexp, cexp)])
            except FileNotFoundError:
                golden_errors.append(f"Golden file not found: {golden_path} (run with --update-golden once)")
            except Exception as e:
                golden_errors.append(f"Failed reading golden file: {e}")

    # Print a friendly console summary
    print(f"[golden_sales_search] base_url={base_url} cases={len(DEFAULT_CASES)} out={args.out}")
    if report.get("ping") and isinstance(report["ping"], dict):
        if "json" in report["ping"]:
            rv = report["ping"]["json"].get("rv", None)
            print(f"  - ping: status={report['ping'].get('status')} rv={rv}")
        else:
            print(f"  - ping: error={report['ping'].get('error')}")

    for r in case_results:
        name = r["name"]
        ms = r["ms"]
        status = r["status"]
        if r.get("errors"):
            print(f"  - FAIL {name} status={status} {ms}ms")
            for e in r["errors"]:
                print(f"      * {e}")
        else:
            print(f"  - PASS {name} status={status} {ms}ms")

    if golden_path:
        if args.update_golden:
            print(f"[golden_sales_search] wrote golden expectations: {golden_path}")
        else:
            if golden_errors:
                print(f"[golden_sales_search] GOLDEN MISMATCHES ({len(golden_errors)}):")
                for e in golden_errors:
                    print(f"  - {e}")
            else:
                print("[golden_sales_search] golden expectations: OK")

    # Exit code: fail if any case failed OR golden mismatched
    exit_fail = (failed > 0) or (len(golden_errors) > 0)
    return 1 if exit_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())