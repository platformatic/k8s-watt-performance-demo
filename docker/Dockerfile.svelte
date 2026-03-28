FROM node:25-slim
WORKDIR /app
COPY svelte/build build
COPY svelte/data data
COPY svelte/package.json package.json
COPY svelte/node_modules node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build/index.js"]
