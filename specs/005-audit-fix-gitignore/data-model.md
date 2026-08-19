# Data Model: Audit and Refine Project .gitignore

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-19 | **Status**: Complete

## Structure of `.gitignore` Categories

```text
.gitignore
├── 1. Logs & Debug Logs
│   ├── logs/
│   ├── *.log
│   └── *-debug.log* / *-error.log*
├── 2. Dependencies
│   ├── node_modules/
│   ├── .npm/
│   ├── .pnpm-store/
│   └── .yarn/
├── 3. Build & Outputs
│   ├── dist/
│   ├── dist-ssr/
│   ├── build/
│   └── *.tsbuildinfo
├── 4. Testing & Coverage
│   ├── coverage/
│   ├── .nyc_output/
│   ├── .vitest/
│   └── test-results/
├── 5. Environment & Secrets
│   ├── .env*
│   └── !.env.example (WHITELIST)
├── 6. Patches & Temporary Changes
│   ├── *.patch
│   ├── *.diff
│   ├── *.orig
│   └── *.rej
├── 7. Caches & Temporary Storage
│   ├── .vite/
│   ├── .cache/
│   └── *.tmp / *.temp
├── 8. Python Runtime (for scripts like merge.py)
│   ├── __pycache__/
│   ├── *.py[cod]
│   └── .pytest_cache/
├── 9. Databases & Local Dumps
│   ├── dump.rdb
│   ├── *.sqlite
│   └── *.db
├── 10. Editor & IDE Settings
│   ├── .idea/
│   ├── .vscode/*
│   ├── !.vscode/extensions.json (WHITELIST)
│   └── *.suo, *.sln, *.sw?
├── 11. Operating System Artifacts
│   ├── Windows: Thumbs.db, ehthumbs.db, desktop.ini, $RECYCLE.BIN/
│   ├── macOS: .DS_Store, .DS_Store?, ._*, .Spotlight-V100, .Trashes
│   └── Linux: *~, .directory
└── 12. Translation & Export Outputs
    ├── Result/
    ├── result/
    └── exports/
```
