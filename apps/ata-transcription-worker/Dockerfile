# Compila fora da imagem final: rodar via tsx mantinha o compilador de
# TypeScript carregado em memória o tempo todo, num container de 512 MB.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
