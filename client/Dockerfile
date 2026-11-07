# ── Multi-stage Production Dockerfile for React Client ──────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build static files
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# Output stage — copies dist to mounted volume
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/dist /app/dist

CMD ["sh", "-c", "cp -rf /app/dist/. /app/dist_out/ && echo 'Client build successfully copied'"]
