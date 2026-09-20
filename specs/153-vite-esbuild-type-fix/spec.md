# Feature Specification: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Option Trong Quy Trình Kiểm Tra Mã Nguồn (npm run lint)

**Feature Branch**: `153-vite-esbuild-type-fix`

**Created**: 2026-09-21

**Status**: Implemented

**Input**: User description: "Run npm run lint\n\n> ai-dich-truyen-trung-viet-full@1.0.0 lint\n> tsc --noEmit\n\nError: vite.config.ts(9,29): error TS2769: No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '({ mode }: ConfigEnv) => { base: string; plugins: (Plugin<any>[] | { name: string; enforce: \"pre\"; transformIndexHtml(this: MinimalPluginContextWithoutEnvironment, html: string): string; closeBundle?: undefined; configureServer?: undefined; } | { ...; })[]; ... 4 more ...; preview: { ...; }; }' is not assignable to parameter of type 'UserConfigExport'.\n      Type '({ mode }: ConfigEnv) => { base: string; plugins: (Plugin<any>[] | { name: string; enforce: \"pre\"; transformIndexHtml(this: MinimalPluginContextWithoutEnvironment, html: string): string; closeBundle?: undefined; configureServer?: undefined; } | { ...; })[]; ... 4 more ...; preview: { ...; }; }' is not assignable to type 'UserConfigFnObject'.\n        Call signature return types '{ base: string; plugins: (Plugin<any>[] | { name: string; enforce: \"pre\"; transformIndexHtml(this: MinimalPluginContextWithoutEnvironment, html: string): string; closeBundle?: undefined; configureServer?: undefined; } | { ...; })[]; ... 4 more ...; preview: { ...; }; }' and 'UserConfig' are incompatible.\n          The types of 'esbuild' are incompatible between these types.\n            Type '{ drop: (\"console\" | \"debugger\")[]; }' is not assignable to type 'false | ESBuildOptions | undefined'.\nError: Process completed with exit code 2.\ntôi bị lỗi này"

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Type Check Success Without Build Config Overload Failures (Priority: P1)

Developers and continuous integration workflows require the static type checking command (`npm run lint` running `tsc --noEmit`) to complete cleanly with exit code 0 on all operating systems and CI runners (specifically Ubuntu in GitHub Actions), without triggering TypeScript TS2769 overload resolution errors on `vite.config.ts`.

**Why this priority**: Lỗi kiểm tra kiểu tĩnh chặn đứng bước `Type check` trên GitHub Actions CI, khiến quy trình tự động hóa kiểm thử và release bị gián đoạn hoàn toàn theo Principle I của Constitution.

**Independent Test**: Chạy `npm run lint` (`tsc --noEmit`) trên kho mã nguồn và xác nhận quá trình kết thúc với exit code 0, không có bất kỳ thông báo lỗi `TS2769` hay lỗi kiểu nào tại `vite.config.ts`.

**Acceptance Scenarios**:

1. **Given** a CI/CD environment or local developer workstation executing `npm run lint` (`tsc --noEmit`), **When** TypeScript checks `vite.config.ts`, **Then** the configuration function return type is unambiguously recognized as compatible with `UserConfig` without triggering overload resolution failures.
2. **Given** the `esbuild` options block within `vite.config.ts`, **When** the type checker verifies properties against `ESBuildOptions`, **Then** the `drop` property or configuration object is typed safely and accepted cleanly by `ESBuildOptions`.

---

### User Story 2 - Production Optimization Retention (Priority: P2)

Developers and operations require the production build pipeline (`npm run build`) to retain the optimization that strips `console` and `debugger` statements from client bundles in production mode, while preserving developer logging and debugging in non-production environments.

**Why this priority**: Việc chuẩn hóa kiểu dữ liệu cấu hình không được làm mất tính năng loại bỏ log và breakpoint bảo mật khi đóng gói sản phẩm ra bản phát hành.

**Independent Test**: Chạy `npm run build` và xác nhận bundle trong thư mục `dist/` được tạo thành công không lỗi; đồng thời chạy `npm test` để xác nhận 100% test suites vẫn pass.

**Acceptance Scenarios**:

1. **Given** `NODE_ENV === 'production'`, **When** `npm run build` is executed, **Then** Vite compiles the production bundle into `dist/` with console/debugger removal options active.
2. **Given** a development or test environment, **When** tests run via `npm test`, **Then** all existing unit and integration tests pass without regression.

---

### Edge Cases

- **Môi trường `process.env.NODE_ENV` không xác định (undefined)**: Cấu hình phải đối xử an toàn như môi trường non-production, không gán mảng drop gây lỗi hoặc làm mất log phát triển.
- **Tương thích kiểu giữa các phiên bản Vite và esbuild**: Ép kiểu tường minh (`as ESBuildOptions` hoặc `: UserConfig`) phải bảo đảm không bị ảnh hưởng bởi sự khác biệt nhỏ về type resolution giữa npm trên Windows và npm trên Linux CI runner.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The build configuration file (`vite.config.ts`) MUST export a configuration function whose return type is explicitly annotated or structured as compatible with Vite's `UserConfig` interface.
- **FR-002**: The static type checking command (`npm run lint`, executing `tsc --noEmit`) MUST terminate with exit code 0 and 0 type errors on both developer workstations and GitHub Actions CI.
- **FR-003**: The `esbuild` configuration block inside `vite.config.ts` MUST be typed in a manner that satisfies the `false | ESBuildOptions | undefined` union type without TypeScript overload fallback failures.
- **FR-004**: In production mode (`NODE_ENV === 'production'`), the build configuration MUST configure esbuild to drop `console` and `debugger` statements.
- **FR-005**: In non-production modes, the build configuration MUST safely provide an empty or undefined drop configuration so that no debug statements are dropped inadvertently.

### Key Entities

- **ViteUserConfig**: Cấu hình chuẩn của Vite (`UserConfig`) bao gồm các thuộc tính `base`, `plugins`, `server`, `resolve`, `esbuild`, `build`, và `preview`.
- **ESBuildOptions**: Tập hợp tùy chọn trình biến đổi esbuild được Vite chấp nhận, bao gồm thuộc tính `drop?: ('console' | 'debugger')[]`.

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lệnh `npm run lint` (`tsc --noEmit`) hoàn thành với mã thoát `0` và 0 lỗi kiểu dữ liệu trên toàn bộ dự án.
- **SC-002**: Không có bất kỳ lỗi `TS2769: No overload matches this call` nào xuất hiện tại `vite.config.ts`.
- **SC-003**: 100% test suites tự động (`npm test`) tiếp tục đạt kết quả pass (92/92 test files, 845/845 tests).
- **SC-004**: Lệnh `npm run build` tạo thành công thư mục `dist/` với bundle hoàn chỉnh.

---

## 4. Assumptions

- Kho mã nguồn tiếp tục sử dụng Node.js 20 LTS và TypeScript ~5.8.2 theo tiêu chuẩn của dự án.
- Gói `vite@^6.2.3` xuất khẩu đầy đủ các kiểu dữ liệu `UserConfig` và `ESBuildOptions`.
