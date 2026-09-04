import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: process.env.VITE_BASE_URL || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      sourcemap: false,
      /**
       * chunkSizeWarningLimit được cấu hình ở mức 1200 KB (thay vì mặc định 500 KB của Vite):
       * 
       * 1. Lý do kích thước:
       *    - Thư viện `opencc-js` chứa toàn bộ bảng từ điển ánh xạ Phồn thể -> Giản thể (Traditional to Simplified
       *      Chinese dictionary tables), dẫn đến kích thước bundle `vendor-opencc` đạt ~1.12MB (485KB gzip).
       * 
       * 2. Lý do không thể lazy-load bất đồng bộ:
       *    - Các hàm chuẩn hóa Hán-Việt trong `@shared/sinoNormalize.ts` (`canonicalizeHan`, `isHanEquivalent`,
       *      `validateAndSnapBackEntities`, `findFuzzyCandidates`) được gọi đồng bộ (synchronous) liên tục
       *      trong toàn bộ vòng đời ứng dụng: React Hooks (`useProjects`, `useTranslationProcess`, `useGlossaryDuplicates`),
       *      `useMemo` tìm kiếm/lọc danh sách từ điển, và kiểm tra trùng lặp thời gian thực khi người dùng nhập liệu.
       *    - Việc chuyển sang dynamic `import()` bất đồng bộ sẽ phá vỡ các hàm lọc mảng đồng bộ (`.filter()`, `.some()`)
       *      và tạo nguy cơ sai lệch dữ liệu nghiêm trọng (false negatives) khi so khớp chữ Hán trước khi module nạp xong.
       * 
       * 3. Chiến lược tối ưu hóa chunking:
       *    - Tách `opencc-js` thành một `manualChunk` riêng biệt mang tên `vendor-opencc`.
       *    - Điều này đảm bảo entry bundle chính (`index.js` ~93KB) và React bundle (`vendor-react` ~219KB)
       *      vẫn giữ được kích thước rất nhỏ gọn và tải nhanh, đồng thời trình duyệt có thể cache `vendor-opencc` dài hạn.
       */
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('opencc-js')) {
                return 'vendor-opencc';
              }
              if (id.includes('jszip')) {
                return 'vendor-jszip';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/*.crdownload', '**/*.tmp', '**/*.part'],
      },
    },
  };
});
