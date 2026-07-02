# PPROF Analysis: HEAP

**Profile:** `heap-profile-2026-07-02T14-25-01-718Z.pb`
**Duration:** N/A | **Samples:** 35 | **Type:** inuse_space (bytes)

## Top Hotspots (by self-time)

| Rank | Function | Self% | Cum% | Location |
|------|----------|-------|------|----------|
| 1 | `(external)` | 63.9% | 63.9% | `<native>` |
| 2 | `serialize` | 8.8% | 20.1% | `profile-serializer.js:48` |
| 3 | `measureNumberArrayField` | 5.6% | 5.6% | `index.js:177` |
| 4 | `split` | 4.1% | 4.1% | `<native>` |
| 5 | `resolve` | 3.2% | 3.2% | `node:path:1245` |
| 6 | `originalPositionFor` | 1.6% | 1.6% | `source-map-consumer.js:478` |
| 7 | `measureLengthDelimArrayField` | 1.6% | 1.6% | `index.js:193` |

## Critical Paths (top cumulative chains)

1. **[63.9%]** 
2. **[28.9%]** `(anonymous:L#589:C#24)` → `stopProfilerQuick` → `stop` → `serializeTimeProfile` → `serialize` → `getLocation` → `mapper.mappingInfo` → `split`
3. **[8.0%]** `(anonymous:L#589:C#24)` → `stopProfilerQuick` → `encode` → `_encodeToBuffer` → `_encodeSamplesToBuffer` → `get length` → `measureNumberArrayField`
4. **[6.4%]** `(anonymous)` → `createFlightRouterStateFromLoaderTreeImpl` → `createFlightRouterStateFromLoaderTreeImpl` → `createFlightRouterStateFromLoaderTreeImpl` → `createFlightRouterStateFromLoaderTreeImpl` → `__TURBOPACK__page__$23$6__` → `commonJsRequire` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `(anonymous:L#5:C#24)` → `esmImport` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `(anonymous:L#2:C#47)` → `esmImport` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `module.exports.Object.defineProperty.value` → `esmImport` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `module.exports.Object.defineProperty.value` → `commonJsRequire` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `module.exports.Object.defineProperty.value` → `commonJsRequire` → `getOrInstantiateModuleFromParent` → `instantiateModule` → `module.exports.Object.defineProperty.value`
5. **[0.8%]** `(anonymous)` → `(anonymous:L#3345:C#43)` → `createNodeInlinedDataStream` → `pullFlightData` → `htmlEscapeJsonString`

## Key Observations

- Native `(external)` dominates (**63.9%** self-time)
- Native code accounts for **68.0%** of self-time
- `serialize` has highest allocation count (potential GC pressure)