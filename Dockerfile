# ==============================================================================
# Dockerfile cho ứng dụng Pure Client-Side SPA (Nginx Alpine)
# ==============================================================================

# Stage 1: Build static assets
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine AS runner

# Tùy biến Nginx cấu hình SPA routing fallback về index.html
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location = /favicon.svg { \
        access_log off; \
        log_not_found off; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
