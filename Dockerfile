FROM node:24-bookworm-slim AS build

WORKDIR /workspace

RUN corepack enable \
    && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile

RUN NODE_OPTIONS=--max-old-space-size=1536 \
    pnpm --filter api build

RUN pnpm --filter api --prod deploy /production \
    && rm -rf /production/dist \
    && cp -a apps/api/dist /production/dist


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=768

COPY --from=build --chown=node:node /production ./

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]