FROM node:24.11.1-alpine3.22 AS node-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
# Fail this layer if npm silently skips the platform-specific bundler binding.
RUN npm ci --include=optional --no-audit --no-fund && node --input-type=module -e "await import('rolldown')"
COPY . .
RUN npm run contracts && npm run build --workspace @khotwa/api && npm run build --workspace @khotwa/web

FROM node-build AS api-test
CMD ["node", "qa/ph04-container.mjs"]

FROM node-build AS ph05-test
CMD ["node", "qa/ph05-container.mjs"]

FROM node-build AS ph06-test
CMD ["node", "qa/ph06-container.mjs"]

FROM node-build AS ph07-test
CMD ["node", "qa/ph07-container.mjs"]

FROM node-build AS node-production
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24.11.1-alpine3.22 AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=node-production --chown=node:node /app/node_modules ./node_modules
COPY --from=node-build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=node-build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=node-build --chown=node:node /app/packages/contracts/openapi.yaml ./packages/contracts/openapi.yaml
COPY --from=node-build --chown=node:node /app/packages/contracts/schemas ./packages/contracts/schemas
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM nginxinc/nginx-unprivileged:1.28.0-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=node-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080

FROM python:3.13.7-slim-bookworm AS math
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 MATH_ENGINE_HOST=0.0.0.0 MATH_ENGINE_PORT=8001
WORKDIR /app
COPY services/math-engine/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir --no-deps -r requirements.lock && useradd --uid 10001 --create-home mathuser
COPY --chown=10001:10001 services/math-engine/src /app/src
ENV PYTHONPATH=/app/src
USER 10001
EXPOSE 8001
CMD ["python", "-m", "khotwa_math"]
