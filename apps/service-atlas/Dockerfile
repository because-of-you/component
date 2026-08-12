FROM node:24-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY apps/service-atlas ./apps/service-atlas
RUN npm run build


FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY apps/service-atlas/deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /workspace/apps/service-atlas/dist/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
