import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import apiRouter from "./server/routes/api.ts";
import { rateLimitByIP } from "./server/middleware/rateLimiter.ts";

dotenv.config();

const app = express();
// Tin tưởng proxy phía trước (Cloud Run / load balancer) để req.ip lấy đúng IP client thật từ X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : 1);

const PORT = 3000;

// Hỗ trợ JSON Body dung lượng lớn cho các chương truyện dài
app.use(express.json({ limit: "15mb" }));

// Rate-limit theo IP cho toàn bộ API endpoints (chống lạm dụng khi không có auth)
app.use("/api", rateLimitByIP);

// Gắn các API endpoints từ router
app.use("/api", apiRouter);


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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully started and listening on http://localhost:${PORT}`);
  });
}

startServer();
