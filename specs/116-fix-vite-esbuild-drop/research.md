# Research: Chuẩn Hóa Kiểu Dữ Liệu Vite Esbuild Drop (116-fix-vite-esbuild-drop)

**Feature**: `116-fix-vite-esbuild-drop`  
**Date**: 2026-09-12  
**Status**: Completed  

---

## 1. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

### 1.1 Hiện tượng lỗi
Khi chạy `npm run lint` (`tsc --noEmit`), trình biên dịch TypeScript báo lỗi:
```text
Error: vite.config.ts(6,29): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type '() => { base: string; plugins: Plugin<any>[][]; resolve: { alias: { '@': string; }; }; esbuild: { drop: string[]; }; build: { outDir: string; emptyOutDir: true; sourcemap: false; chunkSizeWarningLimit: number; rollupOptions: { ...; }; }; server: { ...; }; }' is not assignable to parameter of type 'UserConfigExport'.
      Type '() => { ... }' is not assignable to type 'UserConfigFnObject'.
        Call signature return types '{ ... esbuild: { drop: string[]; }; ... }' and 'UserConfig' are incompatible.
          The types of 'esbuild' are incompatible between these types.
            Type '{ drop: string[]; }' is not assignable to type 'false | ESBuildOptions | undefined'.
```

### 1.2 Cơ chế sinh lỗi
1. Trong [`vite.config.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/vite.config.ts#L15-L17):
   ```ts
   esbuild: {
     drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
   },
   ```
2. Biểu thức tam nguyên `process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []` được TypeScript tự động mở rộng (widen) thành mảng chuỗi chung `string[]`.
3. Trong định nghĩa kiểu của `vite` (kế thừa từ `esbuild`):
   - `export type Drop = 'console' | 'debugger';`
   - `ESBuildOptions.drop?: Drop[];`
4. Kiểu `string[]` không tương thích với `Drop[]` (`('console' | 'debugger')[]`) vì `string` có thể chứa bất kỳ chuỗi nào ngoài `'console'` và `'debugger'`.
5. Hàm `defineConfig` nhận một callback không khai báo kiểu trả về tường minh:
   ```ts
   export default defineConfig(() => {
     return { ... };
   });
   ```
   TypeScript suy luận kiểu trả về của callback là đối tượng có `drop: string[]`. Khi đối chiếu với các overload của `defineConfig`:
   - `defineConfig(config: UserConfig): UserConfig;`
   - `defineConfig(config: Promise<UserConfig>): Promise<UserConfig>;`
   - `defineConfig(config: UserConfigFnObject): UserConfigFnObject;` (với `UserConfigFnObject = (env: ConfigEnv) => UserConfig`)
   - `defineConfig(config: UserConfigExport): UserConfigExport;`
   Không có overload nào chấp nhận callback trả về `{ esbuild: { drop: string[] } }`, dẫn đến lỗi `TS2769: No overload matches this call`.

---

## 2. Các Phương Án Kỹ Thuật (Decisions & Trade-offs)

### Phương án 1: Sử dụng Type Assertion `as ('console' | 'debugger')[]` hoặc `as Drop[]`
- **Mã thực hiện**:
  ```ts
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? (['console', 'debugger'] as ('console' | 'debugger')[]) : [],
  },
  ```
  hoặc nhập `Drop` từ `esbuild`:
  ```ts
  import type { Drop } from 'esbuild';
  // ...
  esbuild: {
    drop: (process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []) as Drop[],
  },
  ```
- **Ưu điểm**:
  - Tương thích 100% với kiểu mảng có thể biến đổi (`Drop[]`) mà esbuild mong đợi.
  - Không cần thêm dependency mới (`esbuild` đã có sẵn trong dự án qua `vite`).
  - Ép kiểu cục bộ không làm thay đổi các tùy chọn cấu hình khác của Vite.
- **Nhược điểm**: Cần type assertion rõ ràng.

### Phương án 2: Sử dụng `as const`
- **Mã thực hiện**:
  ```ts
  drop: process.env.NODE_ENV === 'production' ? (['console', 'debugger'] as const) : [],
  ```
- **Phân tích rủi ro**:
  - `as const` sinh ra kiểu `readonly ["console", "debugger"]`.
  - Trong một số phiên bản TypeScript / esbuild d.ts, `drop?: Drop[]` được định nghĩa là mảng có thể chỉnh sửa (`Drop[]`), không phải `readonly Drop[]`.
  - Việc gán `readonly ["console", "debugger"]` vào `Drop[]` có thể gây lỗi `The type 'readonly ["console", "debugger"]' is 'readonly' and cannot be assigned to the mutable type 'Drop[]'`.
- **Kết luận**: Từ chối vì tiềm ẩn nguy cơ không tương thích giữa các phiên bản TypeScript.

### Phương án 3: Khai báo kiểu trả về tường minh cho hàm `defineConfig` hoặc biến cấu hình `UserConfig`
- **Mã thực hiện**:
  ```ts
  import { defineConfig, type UserConfig } from 'vite';

  export default defineConfig((): UserConfig => {
    return {
      // ...
      esbuild: {
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      },
      // ...
    };
  });
  ```
- **Phân tích**:
  - Khi callback có kiểu trả về `: UserConfig`, TypeScript áp dụng contextual typing cho đối tượng trả về.
  - Tuy nhiên, trong biểu thức tam nguyên không có type assertion, TypeScript vẫn có thể widen `['console', 'debugger']` thành `string[]` trước khi gán cho `drop?: Drop[]`.
  - Do đó, kết hợp cả `: UserConfig` hoặc ép kiểu `(['console', 'debugger'] as ('console' | 'debugger')[])` là phương án an toàn nhất.

---

## 3. Quyết Định Kỹ Thuật Được Lựa Chọn (Selected Decision)

**Quyết định**: Sử dụng `as ('console' | 'debugger')[]` kết hợp kiểu dữ liệu an toàn ngay tại thuộc tính `esbuild.drop` trong [`vite.config.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/vite.config.ts):

```ts
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? (['console', 'debugger'] as ('console' | 'debugger')[]) : [],
    },
```

### Lý do chọn:
1. Giải quyết triệt để vấn đề type widening của TypeScript đối với ternary expression.
2. Không phụ thuộc vào việc import thêm package mới hay thay đổi định dạng của `vite.config.ts`.
3. Tương thích với tất cả các phiên bản của `vite` (từ 6.x đến 8.x) và `esbuild` (0.25+ đến 0.28+).
4. Duy trì chính xác hành vi loại bỏ `console` và `debugger` khi `NODE_ENV === 'production'`.
