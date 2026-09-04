# ==============================================================================
# Dockerfile chuẩn hóa Production (Multi-Stage Build & Non-Root Hardening)
# ==============================================================================

# Stage 1: Build & Bundle
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt dependencies đầy đủ để build
COPY package*.json ./
RUN npm ci

# Copy mã nguồn và thực thi build client + server
COPY . .
RUN npm run build

# Stage 2: Runtime Runner (Tối giản kích thước và bảo mật tối đa)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Chạy với user non-root 'node' (UID 1000) chống leo thang đặc quyền container
USER node

# Cài đặt dependencies production-only
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy artifacts đã biên dịch từ builder stage
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000

# Container Healthcheck probe kiểm tra liveness định kỳ
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/live || exit 1

# Khởi chạy server biên dịch tách biệt
CMD ["node", "dist/server/server.cjs"]
