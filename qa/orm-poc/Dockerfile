FROM node:24.11.1-alpine3.22
WORKDIR /poc
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npx prisma generate
COPY poc.mjs ./poc.mjs
CMD ["sh", "-c", "npx prisma migrate deploy && node poc.mjs && npx prisma migrate reset --force && node poc.mjs replay"]
