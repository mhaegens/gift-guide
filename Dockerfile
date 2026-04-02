# Stage 1 — install dependencies (native compilation for better-sqlite3)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --omit=dev --ignore-scripts
RUN npm rebuild better-sqlite3 sqlite3
RUN npm ci --prefix client

# Stage 2 — build the Vue frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY . .
RUN npm run build

# Stage 3 — production runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY server ./server
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p data
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
