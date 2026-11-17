# Build context: repository root (npm workspaces). See docker-compose.yml.
FROM node:24-slim AS build
WORKDIR /app
# Test-only database binaries are not needed in an image.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w @mini-trello/shared -w @mini-trello/backend
COPY tsconfig.base.json ./
COPY shared shared
COPY backend backend
# Bundles the API and the shared contract into backend/dist/server.js.
RUN npm run build -w @mini-trello/backend

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w @mini-trello/backend --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
USER node
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
