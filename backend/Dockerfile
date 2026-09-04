FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh /app/

RUN npx prisma generate

RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
