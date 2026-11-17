# Build context: repository root (npm workspaces). See docker-compose.yml.
FROM node:24-slim
WORKDIR /app
ENV MONGOMS_DISABLE_POSTINSTALL=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w @mini-trello/shared -w @mini-trello/frontend
COPY tsconfig.base.json ./
COPY shared shared
COPY frontend frontend
# The API URL is used by the browser, so it is inlined at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @mini-trello/frontend
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@mini-trello/frontend"]
