# Requirements Checklist: Zero Model Verification in Translation Hot Path

## User Story 1: Zero Model Verification in Translation Hot Path (P1 🎯 MVP)
- [ ] Audit `validateModelMiddleware`: Ensure it performs zero outbound HTTP requests.
- [ ] Audit `modelInfoService.isModelVerified`: Refactor or provide cached-only lookup (`isModelVerifiedCached` / `{ allowProbe: false }`).
- [ ] Translation hot path routes (`/translate-raw`, `/polish-translation`, `/qa-critique`, `/align-chapter`, etc.) immediately reject unverified/uncached models with 400 `MODEL_UNVERIFIED`.
- [ ] Unit tests for cache hit (0 network calls) and cache miss (immediate 400 rejection with 0 network calls).

## User Story 2: Single-Flight Concurrency Deduplication (P1 🎯 MVP)
- [ ] Implement `inFlightVerifications: Map<string, Promise<ModelDefinition>>` in `modelInfoService`.
- [ ] Coalesce $N$ concurrent calls to `verifySingleModel` for the same model ID into 1 provider fetch.
- [ ] Clean up in-flight map in `finally` block on both success and error.
- [ ] Unit test: 20 concurrent verification requests result in exactly 1 fetch call.
- [ ] Unit test: Verification failure properly propagates and cleans up in-flight map.

## User Story 3: Explicit Path vs Hot Path Architecture (P2)
- [ ] Maintain clean separation: `POST /api/verify-model` is the sole endpoint performing outbound verification.
- [ ] Stale cache handling: Verify stale entries revalidation and explicit refresh support.
- [ ] Integration test: Full flow from verification $\to$ cache population $\to$ hot path execution.

## Quality Gates
- [ ] `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- [ ] `npm test` (`vitest run`) passes 100%.
- [ ] `npm run build` succeeds without bundle errors.
