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

# SSRT arm: the components on the /sellers render path must compile into
# templates without bailouts, otherwise the arm would measure plain rendering.
RUN if [ "$SSRT_ENABLED" = "1" ]; then \
      node scripts/check-ssrt-templates.cjs src/app/layout.tsx src/app/sellers/page.tsx; \
    fi

RUN npm run build

# Fail the build when the compiled bundle does not match the requested arm.
# SSRT arm: the Turbopack chunk that bundles src/app/sellers/page.tsx (the only
# page the load test hits) must contain template call sites; templates elsewhere
# do not count. Control arm: no template call sites anywhere. Busybox grep has
# no --include, hence the find pipelines.
RUN total=$(find .next/server -name "*.js" -exec grep -ohE "flightTemplate|jsxTemplate|renderTemplate" {} + | wc -l); \
    sellers=0; \
    for chunk in $(find .next/server -name "*.js" -exec grep -l "src/app/sellers/page.tsx" {} +); do \
      n=$(grep -oE "flightTemplate|jsxTemplate|renderTemplate" "$chunk" | wc -l); \
      sellers=$((sellers + n)); \
    done; \
    echo "SSRT template call sites: total=$total sellers-page-chunks=$sellers"; \
    if [ "$SSRT_ENABLED" = "1" ] && [ "$sellers" -eq 0 ]; then \
      echo "SSRT_ENABLED=1 but the sellers page was not compiled into templates" >&2; exit 1; \
    fi; \
    if [ "$SSRT_ENABLED" != "1" ] && [ "$total" -ne 0 ]; then \
      echo "SSRT_ENABLED=$SSRT_ENABLED but the bundle contains SSR templates" >&2; exit 1; \
    fi

ENTRYPOINT ["./entrypoint.sh"]

LABEL org.opencontainers.image.authors="Platformatic"
LABEL org.opencontainers.image.created="$BUILD_TIME"
LABEL org.opencontainers.image.revision="$COMMIT_HASH"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/platformatic/watt-performance-demos"
LABEL org.opencontainers.image.title="demos/next"
LABEL org.opencontainers.image.description="Next.js starter that can be run with Node or wattpm"
