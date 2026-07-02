FROM node:24.11.0-alpine

ARG COMMIT_HASH
ARG BUILD_TIME
# Pin the Next.js version for this image. The version comparison sweep builds one
# image per version (16.2.9 stable vs 16.3.0-canary.72 latest). Empty = use the
# version pinned in package.json.
ARG NEXT_VERSION=""

WORKDIR /app

COPY . ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install npm -g

# Override the pinned Next.js version when NEXT_VERSION is provided.
RUN if [ -n "$NEXT_VERSION" ]; then npm pkg set dependencies.next="$NEXT_VERSION"; fi

RUN npm install && npm cache clean --force
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
