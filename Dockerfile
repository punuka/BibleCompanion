# Deploys apps/api. Build context is the repo root — this is an npm
# workspaces monorepo (the API depends on packages/shared's compiled dist/
# output), and `npm ci` needs the full workspace layout to match
# package-lock.json exactly, so the whole repo is copied in (see
# .dockerignore for what's excluded — mainly node_modules and the Android
# build tree, which are not needed to install or run the API).
FROM node:20-slim

# Prisma's engines need OpenSSL at runtime on Debian-based images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build:shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

WORKDIR /app/apps/api
EXPOSE 8787
CMD ["npm", "run", "start"]
