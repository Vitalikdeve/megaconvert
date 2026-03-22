FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/crypto/package.json ./packages/crypto/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci

FROM deps AS build

COPY apps/server ./apps/server
COPY packages/crypto ./packages/crypto
COPY packages/shared ./packages/shared

RUN npm run build -w @messenger/shared
RUN npm run build -w @messenger/crypto
RUN npm run build -w @messenger/server

FROM node:22-alpine AS runtime-deps

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/crypto/package.json ./packages/crypto/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=runtime-deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/crypto/package.json ./packages/crypto/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

RUN addgroup -S messenger && adduser -S messenger -G messenger
RUN chown -R messenger:messenger /app

USER messenger

EXPOSE 8080
EXPOSE 8090

CMD ["npm", "run", "start", "-w", "@messenger/server"]
