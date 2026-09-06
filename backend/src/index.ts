import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDriver, verifyConnectivity } from "./db.js";
import { ensureConstraints } from "./services/kg.js";
import { apiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);

async function bootstrap() {
  console.log("🔌 连接 Neo4j...");
  await verifyConnectivity();
  await ensureConstraints();
  console.log("✅ Neo4j 就绪");

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", apiRouter);

  // 生产环境托管前端构建产物
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: err.message || "服务器错误" });
    },
  );

  const server = app.listen(port, () => {
    console.log(`🚀 API: http://localhost:${port}/api`);
  });

  const shutdown = async () => {
    server.close();
    await closeDriver();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("❌ 启动失败:", err);
  process.exit(1);
});
