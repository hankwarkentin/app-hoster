# Node.js + TypeScript Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN rm -rf dist && npx tsc

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/.env ./
RUN npm install --omit=dev
EXPOSE 3000
	CMD ["node", "dist/index.js"]
