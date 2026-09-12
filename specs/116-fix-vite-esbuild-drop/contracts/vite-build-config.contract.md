# Contract: Cấu Hình Tùy Chọn Build Vite (vite.config.ts)

**Contract Name**: Vite Build Configuration & esbuild Optimization  
**File**: `vite.config.ts`  
**Consumer**: Vite CLI, Vitest, TypeScript Compiler (`tsc`), GitHub Actions CI  

---

## 1. Input Contract

Cấu hình nhận các biến môi trường sau từ hệ điều hành và tiến trình Node.js:

| Tên biến | Kiểu dữ liệu | Giá trị mẫu | Ý nghĩa |
|---|---|---|---|
| `process.env.NODE_ENV` | `string \| undefined` | `'production'`, `'development'`, `'test'` | Xác định môi trường thực thi để bật tối ưu hóa drop log |
| `process.env.VITE_BASE_URL` | `string \| undefined` | `'/'` | Đường dẫn base của ứng dụng SPA |
| `process.env.DISABLE_HMR` | `string \| undefined` | `'true'`, `'false'` | Vô hiệu hóa Hot Module Replacement khi cần tiết kiệm tài nguyên |

---

## 2. Output Contract

Hàm xuất mặc định trả về đối tượng tương thích hoàn toàn với kiểu `UserConfig` của Vite:

```ts
interface ViteConfigOutput {
  base: string;
  plugins: PluginOption[];
  resolve: {
    alias: Record<string, string>;
  };
  esbuild: {
    drop: ('console' | 'debugger')[];
  };
  build: {
    outDir: string;
    emptyOutDir: boolean;
    sourcemap: boolean;
    chunkSizeWarningLimit: number;
    rollupOptions: {
      output: {
        manualChunks: (id: string) => string | undefined;
      };
    };
  };
  server: {
    hmr: boolean;
    watch: { ignored: string[] } | null;
  };
}
```

---

## 3. Invariants & Safety Guarantees

1. **Khớp Chữ Ký Hàm (Overload Match)**:
   Callback truyền vào `defineConfig` PHẢI trả về đối tượng tương thích với `UserConfigFnObject` hoặc `UserConfigExport` mà không sinh ra lỗi `TS2769`.
2. **Khử Bỏ Log An Toàn Trong Production**:
   Thuộc tính `esbuild.drop` trả về mảng `['console', 'debugger']` khi và chỉ khi `NODE_ENV === 'production'`.
3. **Giữ Nguyên Cấu Hình Chunking**:
   Các nhóm chunk `vendor-react`, `vendor-motion`, `vendor-opencc`, `vendor-jszip`, `vendor-icons` không bị xáo trộn.
