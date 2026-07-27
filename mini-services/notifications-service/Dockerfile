# ============================================================
# ChemStab Notifications Service — Dockerfile (single-stage + bun)
# ============================================================
#
# Simple single-stage build for the Socket.IO notifications mini-service.
# The service is lightweight (express + socket.io) so no multi-stage
# optimisation is needed.
#
# Port: 3003 (hardcoded in index.ts)
# ============================================================

FROM oven/bun:1-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy dependency manifests and install
COPY --chown=appuser:appgroup package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the service entry point
COPY --chown=appuser:appgroup index.ts ./

# Expose the notifications service port (hardcoded in index.ts)
EXPOSE 3003

# Healthcheck — verify socket.io engine.io polling handshake responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f "http://localhost:3003/?EIO=4&transport=polling" || exit 1

# Start the notifications service
CMD ["bun", "run", "start"]
