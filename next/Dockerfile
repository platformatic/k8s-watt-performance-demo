FROM node:24.11.0-alpine

ARG COMMIT_HASH
ARG BUILD_TIME

WORKDIR /app

COPY . ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install npm -g

RUN npm install && npm cache clean --force

RUN npm install -g "@platformatic/watt-extra@latest"

EXPOSE 3042
EXPOSE 9090

ENV PORT=3042
ENV HOSTNAME=0.0.0.0
ENV LOG_LEVEL=error
ENV PLT_MANAGEMENT_API=false
ENV PLT_SERVER_METRICS=true
ENV PLT_SERVER_HEALTH=true
ENV PLT_ICC_URL="http://icc.platformatic.svc.cluster.local"
ENV PLT_ELU_HEALTH_SIGNAL_THRESHOLD=0.7
ENV PLT_HEAP_HEALTH_SIGNAL_THRESHOLD="1500MB"
ENV PLT_DISABLE_FLAMEGRAPHS=true
ENV WORKERS=1
ENV BACKLOG=511
ENV NODE_ENV=production

RUN npm run build

CMD ["watt-extra", "start"]

LABEL org.opencontainers.image.authors="Platformatic"
LABEL org.opencontainers.image.created="$BUILD_TIME"
LABEL org.opencontainers.image.revision="$COMMIT_HASH"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/platformatic/watt-performance-demos"
LABEL org.opencontainers.image.title="demos/next"
LABEL org.opencontainers.image.description="Next.js app running under watt-extra for scaler benchmarking"
