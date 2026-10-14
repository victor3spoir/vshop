FROM oven/bun:1.4.2-alpine AS base
FROM base AS builder

WORKDIR /usr/app 
COPY package.json bun.lock ./ 
RUN bun install --frozen-lockfile 
COPY . . 
RUN bun run build

FROM base AS deploy
WORKDIR /usr/app
ENV NODE_ENV=production \
  PORT=3000 \
  HOST=0.0.0.0 \
  DATABASE_URL= \
  BETTER_AUTH_URL= \
  BETTER_AUTH_SECRET= \
  SERVER_API_URL= \
  VITE_API_URL=
  
COPY --from=builder /usr/app/.output ./.output
COPY --from=builder --chown=bun:bun /usr/app/package.json ./

COPY --from=builder --chown=bun:bun /usr/app/prisma ./prisma
COPY --from=builder --chown=bun:bun /usr/app/prisma.config.ts ./
EXPOSE 3000
ENTRYPOINT [ "bun" ]
CMD ["./.output/server/index.mjs"]