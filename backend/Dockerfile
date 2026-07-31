FROM node:22.23.1-alpine3.23 AS dependencies

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22.23.1-alpine3.23 AS production-dependencies

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.23.1-alpine3.23 AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

RUN mkdir -p /app/backend/uploads /app/backend/private-uploads \
  && chown -R node:node /app/backend

COPY --from=production-dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node backend/package.json ./package.json
COPY --chown=node:node backend/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=node:node database /app/database

RUN chmod 0555 ./docker-entrypoint.sh \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/bin/pnpm \
    /usr/local/bin/pnpx \
    /opt/yarn-v1.22.22

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
