import express from "express";
import path from "path";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import apiRouter from "./server/routes/api";
import { createRateLimiter } from "./server/middleware/rateLimiter";
import { metricsMiddleware } from "./server/middleware/metricsMiddleware";
import { SERVER_CONFIG } from "@shared/constants";
import { redisManager } from "./server/services/redisService";
import { setupWebSocketRelay } from "./server/services/websocketRelayService";
import { setupCrdtRedisPubSub, cleanupCrdtRedisPubSub } from "./server/services/crdtRedisPubSub";

import { requestIdMiddleware } from "./server/middleware/tracingMiddleware";

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Gắn Request ID đầu tiên cho toàn bộ chuỗi middleware
app.use(requestIdMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false, // Tắt CSP ở môi trường dev để Vite HMR (ws://) và React Fast Refresh preamble hoạt động bình thường
  })
);
// Tin tưởng proxy phía trước (Cloud Run / load balancer) để req.ip lấy đúng IP client thật từ X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : 1);

const PORT = process.env.PORT ? Number(process.env.PORT) : SERVER_CONFIG.DEFAULT_PORT;

// Structured HTTP logging & metrics collection
app.use(metricsMiddleware);

// Hỗ trợ JSON Body dung lượng lớn cho các chương truyện dài
app.use(express.json({ limit: SERVER_CONFIG.BODY_SIZE_LIMIT }));

// Rate-limit theo IP cho toàn bộ API endpoints (chống lạm dụng khi không có auth)
app.use("/api", createRateLimiter({ endpointType: 'translation' }));

// Gắn các API endpoints từ router
app.use("/api", apiRouter);

// Top-level aliases cho health/liveness/readiness probes (dành cho container orchestrators)
app.get("/health", (req, res, next) => { req.url = "/health"; apiRouter(req, res, next); });
app.get("/live", (req, res, next) => { req.url = "/live"; apiRouter(req, res, next); });
app.get("/ready", (req, res, next) => { req.url = "/ready"; apiRouter(req, res, next); });


// Tích hợp Vite middleware phục vụ Single Page Application
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully started and listening on http://localhost:${PORT}`);
    if (!process.env.REDIS_URL) {
      console.warn("[RateLimiter] Đang dùng in-memory rate limiter — CHỈ chính xác khi chạy 1 instance. Nếu scale nhiều instance, hãy cấu hình REDIS_URL để bật rate limiter phân tán.");
    }
  });

  // Gắn WebSocket Relay phục vụ đồng bộ real-time CRDT (Yjs) tại /ws/sync
  setupWebSocketRelay(server);
  setupCrdtRedisPubSub();

  const shutdown = async () => {
    console.log("\n[Server] Shutting down server gracefully...");
    try {
      await cleanupCrdtRedisPubSub();
      await redisManager.close();
      console.log("[Server] Redis connections closed.");
    } catch (err) {
      console.error("[Server] Error closing Redis connections:", err);
    }
    server.close(() => {
      console.log("[Server] HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
