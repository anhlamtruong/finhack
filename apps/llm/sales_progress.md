## Done
- [x] `/v1/sales/ping` health endpoint
- [x] `/v1/sales/search` baseline Shopping search (SerpAPI)
- [x] Query ladder + fallback (womenFocus + raw)
- [x] Cache (keyed by query + params), debug shows `cache: hit/miss`
- [x] Post-filter `priceMin/priceMax` (keeps unknown price items)
- [x] Rerank `rankItems()` (prefer discount + women brands)
- [x] Reasons
  - [x] Local deterministic reasons for all items
  - [x] Optional Gemini upgrade for top N (`reasonsMax`)
- [x] Golden test script: `golden_sales_search.py`
  - [x] womenFocus + plain + price cap + facts case (4/4 passing)

## Where now
- [x] Core sales search pipeline working end-to-end
- [!] **Facts enrichment flag mismatch**
  - Request can send `withFacts: true`
  - Current responses show `debug.withFacts: false` + `factsDebug: null`
  - Golden tests pass, but facts currently not being applied/reflected consistently

## Next steps 
- [ ] Fix or clarify `withFacts`
  - [ ] Make enrichment actually run when `withFacts: true`
  - **or**
  - [ ] Disable/remove `withFacts` from API until ready
  - [ ] Update debug fields so they always reflect reality

- [ ] Tighten golden expectations
  - [ ] Assert `debug.withFacts === true` in facts case
  - [ ] Assert `factsDebug != null` or `factsApplied` flag
  - [ ] Add cache test (same request twice ⇒ miss then hit)

## Future (nice-to-have)
- [ ] Move inline facts logic → `providers/multi.ts` (single source of truth)
- [ ] Better womenFocus filtering (avoid non-product results like art prints)
- [ ] Add allow/deny source filters (e.g., prefer grocery/retail vs Etsy)
- [ ] Add structured tags (dietary, allergens, eco, etc.) via facts
- [ ] Add monitoring: latency, cache hit rate, provider error rate