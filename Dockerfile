# Dockerfile for SecureVault
# Multi-stage build for minimal image size

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy app files
COPY server.js ./
COPY vault-single-user.html ./
COPY manifest.json ./
COPY sw.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start app
CMD ["node", "server.js"]
