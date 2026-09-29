# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public/ exists so the runner-stage COPY below never fails (repo has no static assets).
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL: only used so Prisma can parse the schema at build time.
# Railway injects the real DATABASE_URL when the app runs.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# prisma CLI + production deps (for `prisma migrate deploy` on boot)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# standalone Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Apply DB migrations, seed the admin if needed, then start the app
CMD ["node", "scripts/start.mjs"]
