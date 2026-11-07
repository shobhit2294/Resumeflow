# ── Production Dockerfile for ResumeFlow Server ─────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 5000

CMD ["node", "index.js"]

