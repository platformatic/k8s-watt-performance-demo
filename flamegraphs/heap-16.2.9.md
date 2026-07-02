# PPROF Analysis: HEAP

**Profile:** `heap-profile-2026-07-02T14-23-49-366Z.pb`
**Duration:** N/A | **Samples:** 99 | **Type:** inuse_space (bytes)

## Top Hotspots (by self-time)

| Rank | Function | Self% | Cum% | Location |
|------|----------|-------|------|----------|
| 1 | `(external)` | 33.2% | 33.2% | `<native>` |
| 2 | `processFullStringRow` | 13.9% | 21.5% | `react-server-dom-turbopack-client.node.production.js:1871` |
| 3 | `reviveModel` | 5.2% | 7.6% | `react-server-dom-turbopack-client.node.production.js:2070` |
| 4 | `next` | 4.4% | 4.4% | `<native>` |
| 5 | `(anonymous:L#17:C#28)` | 4.0% | 6.0% | `page.tsx:17` |
| 6 | `set` | 3.9% | 3.9% | `<native>` |
| 7 | `jsxProd` | 2.4% | 2.4% | `react-jsx-runtime.react-server.production.js:19` |
| 8 | `measureNumberArrayField` | 2.4% | 3.2% | `index.js:177` |
| 9 | `stop` | 1.6% | 4.0% | `time-profiler.js:115` |
| 10 | `renderModelDestructive` | 1.6% | 7.5% | `react-server-dom-turbopack-server.node.production.js:1536` |

## Critical Paths (top cumulative chains)

1. **[33.2%]** 
2. **[25.8%]** `(anonymous)` → `SellersPage` → `map` → `(anonymous:L#17:C#28)` → `jsxProd`
3. **[25.5%]** `progress` → `processBinaryChunk` → `(anonymous:L#2040:C#13)` → `processFullStringRow` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `reviveModel` → `(anonymous:L#2073:C#9)` → `createPendingChunk`
4. **[14.3%]** `(anonymous:L#589:C#24)` → `stopProfilerQuick` → `encode` → `_encodeToBuffer` → `_encodeSamplesToBuffer` → `_encodeToBuffer` → `next`
5. **[8.3%]** `runMicrotask` → `(anonymous:L#1298:C#27)` → `performWork` → `emitChunk` → `toJSON` → `renderModelDestructive` → `set`

## Key Observations

- Native `(external)` dominates (**33.2%** self-time)
- Native code accounts for **41.5%** of self-time
- `processFullStringRow` has highest allocation count (potential GC pressure)