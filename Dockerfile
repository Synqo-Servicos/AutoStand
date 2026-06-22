FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

# --- Migration runner ---
# Imagem separada (não é a app) que roda `drizzle migrate` de DENTRO da VPC,
# já que o RDS é privado. Reusa scripts/migrate.ts (mesma CA do RDS via
# lib/db). Usada pelo workflow .github/workflows/migrate.yml via ECS RunTask.
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY lib ./lib
# ENTRYPOINT = só o runner; o script vem do CMD (default migrate), e pode ser
# sobrescrito via ECS RunTask command override (ex.: set-superadmin.ts).
ENTRYPOINT ["./node_modules/.bin/tsx"]
CMD ["scripts/migrate.ts"]
