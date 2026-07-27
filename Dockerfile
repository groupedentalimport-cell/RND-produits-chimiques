# ============================================================
# ChemStab — Production Dockerfile (Next.js standalone + bun)
# ============================================================
#
# Multi-stage build:
#   Stage 1 (builder) → install deps, switch to PostgreSQL schema,
#                        generate Prisma client, build Next.js
#   Stage 2 (runner)  → copy standalone output + Prisma client to minimal image
#
# Runtime: bun (not node)
# Next.js config: output: "standalone"
# Database: PostgreSQL (external, configured via DATABASE_URL env var)
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────────

FROM oven/bun:1 AS builder

WORKDIR /app

# Set production env for build optimisation
ENV NODE_ENV=production

# Copy dependency manifests first for cache-efficient installs
COPY package.json bun.lock ./

# Copy Prisma schemas so we can generate the client before building
COPY prisma ./prisma/

# Switch to PostgreSQL schema for production build
RUN cp prisma/schema.prod.prisma prisma/schema.prisma

# Install all dependencies (including devDependencies needed for the build)
RUN bun install --frozen-lockfile

# Generate Prisma client (required before Next.js build)
# Now using PostgreSQL provider
RUN bun run db:generate

# Copy the rest of the application source
COPY . .

# Build Next.js standalone output
# The build script already copies static assets + public into standalone:
#   "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"
RUN bun run build

# ── Stage 2: Runner ───────────────────────────────────────────

FROM oven/bun:1-slim AS runner

WORKDIR /app

# Production environment
ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy the standalone Next.js server output (includes server.js + traced deps)
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./

# Copy public assets (already placed inside standalone by build script,
# but we also copy explicitly for clarity / resilience)
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone/public ./public

# Copy the Prisma generated client (standalone tracing may miss native engines)
# PostgreSQL engine is included since we switched to schema.prod.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# NOTE: No SQLite database directory copied — PostgreSQL uses external DB server
# NOTE: No .env file copied — DATABASE_URL provided via docker-compose environment variables

# Expose the application port
EXPOSE 3000

# Healthcheck — verify the Next.js server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the standalone Next.js server with bun
# The standalone server.js is traced to include only required node_modules
CMD ["bun", "server.js"]
