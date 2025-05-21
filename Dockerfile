# syntax=docker/dockerfile:1.4

FROM --platform=$BUILDPLATFORM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl bash && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn prisma generate
RUN yarn build && yarn build:ws
RUN yarn install --frozen-lockfile --production

FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/dist dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/.env .env

EXPOSE 3000 4000
ENV NODE_ENV=production

CMD ["sh", "-c", "yarn start & yarn start:ws && wait"]
