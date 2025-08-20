# Base
FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Dev (hot-reload)
FROM base AS dev
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build
FROM base AS build
ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN npm run build

# Prod (ligero)
FROM node:18-alpine AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
