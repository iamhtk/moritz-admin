# syntax=docker/dockerfile:1

FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public only — Next inlines these at build. Secrets stay out of the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Opt into standalone output for the runner stage copy below.
ENV DOCKER_BUILD=1

# Bun's node shim segfaults during Next standalone finalize on linux/arm64.
# Real Node runs the same `next build`; Bun stays the package manager and runtime.
RUN apk add --no-cache nodejs \
  && /usr/bin/node ./node_modules/next/dist/bin/next build

FROM oven/bun:1.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["bun", "server.js"]
