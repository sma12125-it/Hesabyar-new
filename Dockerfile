# Multi-stage Dockerfile for HesabYar (Node.js Express + REST API + MCP Server)
# Optimized for Back4app Containers and container runtimes (Node.js LTS)

# -----------------------------------------------------------------------------
# Stage 1: Build static frontend assets
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for tsc and vite)
RUN npm ci

# Copy source tree and compile frontend bundle
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only (tsx is included in dependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend distribution from builder stage
COPY --from=builder /app/dist ./dist

# Copy server code and configs required for runtime execution with tsx
COPY server.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY mcp ./mcp

# Security: switch to non-root user provided by node image
USER node

# Port exposure (Back4app injects PORT dynamically; 3000 is default fallback)
EXPOSE 3000

# Start server via npm start ("tsx server.ts")
CMD ["npm", "start"]
