import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { createRequestHandler } from "@react-router/express";
import { db } from "./app/lib/db.ts";

// Pre-initialize database to avoid file reads during request handling
await db.initialize();

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const logger = pino({ level: LOG_LEVEL });
const app = express();

app.disable("x-powered-by");

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  app.use(pinoHttp({ logger }));
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  logger.info("Starting production server");
  const { entrypoint } = await import(BUILD_PATH)
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(createRequestHandler({ build: () => entrypoint }));
}

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
