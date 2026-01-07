FROM node:24.11.0-alpine

ARG COMMIT_HASH
ARG BUILD_TIME

WORKDIR /app

COPY . ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install npm -g

RUN npm install && npm cache clean --force
RUN chmod +x entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLT_SERVER_LOGGER_LEVEL=info
ENV PLT_MANAGEMENT_API=false

RUN npm run build

ENTRYPOINT ["./entrypoint.sh"]

LABEL org.opencontainers.image.authors="Platformatic"
LABEL org.opencontainers.image.created="$BUILD_TIME"
LABEL org.opencontainers.image.revision="$COMMIT_HASH"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/platformatic/watt-performance-demos"
LABEL org.opencontainers.image.title="demos/next"
LABEL org.opencontainers.image.description="Next.js starter that can be run with Node or wattpm"
