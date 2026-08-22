# Quickstart & Verification Guide: Real-Time CRDT Collaboration

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Date**: 2026-08-22

---

## 1. Automated Verification Commands

```bash
# 1. Typecheck (Must be 100% clean)
npm run lint

# 2. Unit & Integration Tests (vitest)
npm test

# 3. Production Build
npm run build
```

---

## 2. Real-Time Collaborative Testing (2 Windows)

1. Start development server: `npm run dev`
2. Open Browser Window 1 (User A) and Browser Window 2 (User B) in Incognito.
3. Open the same shared project and chapter in `BilingualEditor`.
4. Observe the presence avatar pills appearing in the editor top bar.
5. In Window 1, type a new sentence in `rawTranslation` -> Verify Window 2 updates character-by-character in real time (< 100ms).
6. In Window 2, edit `polishedTranslation` -> Verify Window 1 updates immediately.
7. Disconnect network in Window 2 -> type further offline -> Reconnect -> Verify changes automatically converge and sync.
