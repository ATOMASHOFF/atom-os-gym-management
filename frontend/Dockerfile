# ─────────────────────────────────────────────────────────────
# ATOM FITNESS Frontend — Production Dockerfile
# ─────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install && npm cache clean --force

COPY . .

# Build args injected at build time
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ── Stage 2: nginx static server ──────────────────────────────
FROM nginx:1.25-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Our nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/

# Copy built assets from stage 1
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
