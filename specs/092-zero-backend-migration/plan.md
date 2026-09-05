# Implementation Plan: Chuyển API_dich_truyen thành ứng dụng thuần Client-Side (Zero Backend)

**Branch**: `092-zero-backend-migration` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/092-zero-backend-migration/spec.md`

---

## Summary

Chuyển đổi toàn bộ ứng dụng **Bản Thảo Chu Sa - AI Dịch Truyện Trung - Việt** thành Single Page Application (SPA) tĩnh 100%. Loại bỏ hoàn toàn backend Node.js/Express, Redis và WebSocket relay server; đưa toàn bộ việc gọi AI, quản lý API key, hạn mức quota cá nhân (RPM/TPM/RPD) và lưu trữ dữ liệu về phía trình duyệt (IndexedDB / sessionStorage) và Google Drive cá nhân. Đóng gói sản phẩm bằng duy nhất `vite build` và triển khai trên các nền tảng static hosting (Cloudflare Pages, Netlify, Vercel, Docker Nginx).

---

## Technical Context

**Language/Version**: TypeScript ~5.8, ECMAScript 2022 / modern Web APIs  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, `@google/genai`, `yjs`, `y-indexeddb`, `lucide-react`, `motion`  
**Storage**: IndexedDB (`db.ts`, Single Source of Truth), `sessionStorage` (Ephemeral API Keys), `localStorage` (UI Prefs & SWR Model Cache)  
**Testing**: Vitest 4.1 (`npm test`)  
**Target Platform**: Pure Static Hosting (Cloudflare Pages, Netlify, Vercel, GitHub Pages, Nginx Alpine)  
**Project Type**: Pure Client-Side Single Page Application (SPA)  
**Performance Goals**: Tải trang tĩnh ban đầu < 1s, tính toán hạn mức quota < 5ms, độ trễ gọi AI tối thiểu do bỏ proxy trung gian  
**Constraints**: Tuyệt đối không chạy tiến trình Node.js lúc runtime, 100% Client-to-Gemini REST API, không lưu plaintext API keys trong `localStorage`  
**Scale/Scope**: Toàn bộ codebase client, dọn dẹp toàn bộ `server/` và `server.ts`, 56 test files / 328 tests  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú tuân thủ |
|:---|:---:|:---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | **PASS** | `npm run lint` (0 lỗi type), `npm test` (328/328 tests pass 100%), `npm run build` (thành công). |
| **II. Dependency Minimization & Existing Reuse** | **PASS** | Gỡ bỏ các thư viện backend (`express`, `ioredis`, `ws`, `helmet`, `tsx`). Không thêm bất kỳ thư viện NPM mới nào. |
| **III. Strict Concern Separation** | **PASS** | Logic dịch thuật 3 giai đoạn và prompt kỹ thuật được giữ nguyên chất lượng, chuyển sang gọi trực tiếp qua `directGeminiClient.ts`. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | Schema IndexedDB cho các dự án, chương truyện và từ điển được bảo toàn nguyên vẹn. Nhãn tiếng Việt được duy trì chuẩn xác. |
| **V. Atomic Commits & Documentation Sync** | **PASS** | `README.md`, `docs/architecture.md`, `docs/quota-and-scheduling.md`, và `public/llms.txt` được cập nhật đồng bộ 1:1 với kiến trúc mới. |

---

## Project Structure

### Documentation (this feature)

```text
specs/092-zero-backend-migration/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Architecture decisions & research findings
├── data-model.md        # State definitions & data structures
├── quickstart.md        # Validation & verification guide
└── contracts/           # Interfaces & hosting header contracts
    ├── client-quota-tracker.md
    └── static-security-headers.md
```

### Source Code (repository layout)

```text
├── src/                                # Frontend Source (React 19 + TypeScript)
│   ├── components/                     # UI Components
│   │   ├── google-sync/                # Google Drive Sync & Collaboration UI
│   │   ├── translator-workspace/       # Workspace & thanh công cụ dịch
│   │   └── ui/                         # Atomic Primitives (Button, Badge, Seal...)
│   ├── context/                        # React Contexts (ThemeContext, etc.)
│   ├── hooks/                          # Custom Hooks (useAIConfig, useChapterCRDT...)
│   ├── lib/                            # Utilities (cn.ts)
│   ├── services/                       # Dịch vụ cốt lõi:
│   │   ├── db.ts                       # IndexedDB Service (Single Source of Truth)
│   │   ├── directGeminiClient.ts       # Direct Gemini REST Client
│   │   ├── directTranslationEngine.ts  # Translation Engine Client-side
│   │   ├── directGlossaryEngine.ts     # Glossary Engine Client-side
│   │   ├── localQuotaTracker.ts        # Quota Tracker, Key Health & Circuit Breaker
│   │   └── googleDriveSyncService.ts   # Google Drive Backup & Sync
│   ├── utils/                          # Tiện ích bổ trợ (textCleaner, storageAudit...)
│   └── types.ts                        # TypeScript Data Models
├── shared/                             # Các tiện ích và hằng số dùng chung
│   ├── constants.ts                    # Hằng số cấu hình hệ thống
│   ├── sinoNormalize.ts                # Chuẩn hóa Hán-Việt & từ điển Phồn-Giản
│   └── text.ts                         # Xử lý chuỗi & Redaction bảo mật
├── public/                             # Tài nguyên tĩnh & Header hosting
│   ├── _headers                        # Security headers cho Cloudflare Pages / Netlify
│   └── llms.txt                        # Hướng dẫn AI crawlers
├── vercel.json                         # SPA rewrites & security headers cho Vercel
├── Dockerfile                          # Multi-stage Nginx Alpine static runner
├── vite.config.ts                      # Cấu hình Vite & Rollup Chunking (outDir: dist)
└── package.json                        # Scripts & Dependencies
```

**Structure Decision**: Ứng dụng là Single Page Application tĩnh 100%, không còn bất kỳ mã nguồn backend nào trong thư mục `server/` hay file `server.ts`. Build artifact duy nhất là thư mục `dist/`.

---

## Complexity Tracking

> Không có vi phạm Hiến pháp nào cần giải trình. Kiến trúc được đơn giản hóa triệt để (loại bỏ hoàn toàn 1 tầng hệ thống backend).
