# ─────────────────────────────────────────────────────────────
# ATOM FITNESS API — Production Dockerfile
# Multi-stage: builder installs deps, runner is minimal image
# ─────────────────────────────────────────────────────────────

# ── Stage 1: dependency installer ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first → cached layer unless deps change
COPY package.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: production runner ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY --chown=nodejs:nodejs . .

# Don't run as root
USER nodejs

# Expose API port
EXPOSE 5000

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })" \
  || exit 1

ENV NODE_ENV=production
CMD ["node", "server.js"]
