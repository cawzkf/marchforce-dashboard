# Frontend image — lean multi-stage.
# Node is used ONLY to build the static bundle; the runtime ships just nginx +
# the compiled assets (a few hundred KB), not the toolchain or node_modules.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
