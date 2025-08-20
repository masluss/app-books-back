FROM node:18-alpine AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci


FROM node:18-alpine AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM deps AS dev
WORKDIR /usr/src/app
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM node:18-alpine AS prod
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
