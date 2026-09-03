# syntax=docker/dockerfile:1.7

FROM node:24.11.0-alpine

ARG COMMIT_HASH
ARG BUILD_TIME
ARG SSRT_ENABLED=0

WORKDIR /app

COPY . ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV TEMPLATES=$SSRT_ENABLED

RUN npm install npm -g

RUN --mount=type=secret,id=npmrc,target=/run/secrets/npmrc,required=true \
    NPM_CONFIG_USERCONFIG=/run/secrets/npmrc \
    npm install --legacy-peer-deps --min-release-age=0 \
    && npm cache clean --force
RUN chmod +x entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV LOG_LEVEL=error
ENV PLT_MANAGEMENT_API=false
ENV PLT_SERVER_METRICS=false
ENV PLT_SERVER_HEALTH=false
ENV WORKERS=2
ENV BACKLOG=511
ENV NODE_ENV=production

RUN npm run build

ENTRYPOINT ["./entrypoint.sh"]

LABEL org.opencontainers.image.authors="Platformatic"
LABEL org.opencontainers.image.created="$BUILD_TIME"
LABEL org.opencontainers.image.revision="$COMMIT_HASH"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/platformatic/watt-performance-demos"
LABEL org.opencontainers.image.title="demos/next"
LABEL org.opencontainers.image.description="Next.js starter that can be run with Node or wattpm"
