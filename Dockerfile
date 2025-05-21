FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Install OS dependencies for Prisma (needed for binary builds)
RUN apk add --no-cache openssl

# Copy package files and install all dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Build Next.js app and WebSocket server
RUN yarn build && yarn build:ws

# Remove devDependencies to shrink size
RUN yarn install --production --ignore-scripts --prefer-offline


# -------- Step 2: Runtime Stage --------
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only required files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env ./.env

# Expose both Next.js (3000) and WebSocket (4000) ports
EXPOSE 3000 4000

ENV NODE_ENV=production

# Run both servers in parallel
CMD ["sh", "-c", "yarn start & yarn start:ws && wait"]
