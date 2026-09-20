import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

import { resolvePublicOrigin, transformIndexHtml, transformSitemap } from './src/config/publicOrigin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const publicConfig = resolvePublicOrigin(
    env.VITE_PUBLIC_URL || process.env.VITE_PUBLIC_URL,
    env.VITE_BASE_URL || process.env.VITE_BASE_URL
  );
  if (env.VITE_PUBLIC_URL) {
    process.env.VITE_PUBLIC_URL = publicConfig.origin;
  }
  if (env.VITE_BASE_URL) {
    process.env.VITE_BASE_URL = publicConfig.basePath;
  }
  return {
    base: publicConfig.basePath,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'html-transform-public-url',
        enforce: 'pre',
        transformIndexHtml(html: string) {
          return transformIndexHtml(html, publicConfig);
        },
      },
      {
        name: 'sitemap-transform-public-url',
        closeBundle() {
          const sitemapDist = path.resolve(__dirname, 'dist/sitemap.xml');
          if (fs.existsSync(sitemapDist)) {
            const raw = fs.readFileSync(sitemapDist, 'utf8');
            const transformed = transformSitemap(raw, publicConfig);
            fs.writeFileSync(sitemapDist, transformed, 'utf8');
          }
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/sitemap.xml' || req.url === '/sitemap.xml/') {
              const sitemapPath = path.resolve(__dirname, 'public/sitemap.xml');
              if (fs.existsSync(sitemapPath)) {
                const raw = fs.readFileSync(sitemapPath, 'utf8');
                const transformed = transformSitemap(raw, publicConfig);
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                return res.end(transformed);
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? (['console', 'debugger'] as ('console' | 'debugger')[]) : [],
    },
    build: {
      outDir: 'dist',
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
       *    - Các hàm chuẩn hóa Hán-Việt trong `src/lib/sinoNormalize.ts` (`canonicalizeHan`, `isHanEquivalent`,
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
    preview: {
      headers: {
        'Content-Security-Policy': "upgrade-insecure-requests; default-src 'self'; script-src 'self' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: *.googleusercontent.com; connect-src 'self' https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
      },
    },
  };
});
