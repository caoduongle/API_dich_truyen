# ==============================================================================
# Dockerfile cho ứng dụng Pure Client-Side SPA (Nginx Alpine)
# ==============================================================================

# Stage 1: Build static assets
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build arguments cho public origin và base URL (hỗ trợ custom domain & sub-path)
ARG VITE_PUBLIC_URL
ARG VITE_BASE_URL=/
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
ENV VITE_BASE_URL=$VITE_BASE_URL

RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine AS runner

ARG VITE_BASE_URL=/
ENV VITE_BASE_URL=${VITE_BASE_URL:-/}
ENV NGINX_ENVSUBST_FILTER="VITE_BASE_URL"

# Cấu hình Nginx template hỗ trợ SPA routing và sub-path linh hoạt qua envsubst
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
