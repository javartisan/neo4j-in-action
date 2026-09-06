import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { parseDocumentToGraph } from "../services/parser.js";
import {
  clearGraph,
  deleteEntity,
  getGraph,
  getStats,
  ingestExtractedGraph,
  listEntities,
  searchGraph,
} from "../services/kg.js";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPES,
  RELATION_TYPE_LABELS,
  RELATION_TYPES,
} from "../types.js";

const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = Buffer.from(file.originalname, "latin1").toString("utf8");
    const stamp = Date.now();
    cb(null, `${stamp}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".txt", ".md", ".json", ".csv", ".pdf", ".docx"];
    if (!allowed.includes(ext)) {
      cb(new Error(`仅支持: ${allowed.join(", ")}`));
      return;
    }
    cb(null, true);
  },
});

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "securities-kg" });
});

apiRouter.get("/ontology", (_req, res) => {
  res.json({
    entityTypes: ENTITY_TYPES.map((t) => ({
      type: t,
      label: ENTITY_TYPE_LABELS[t],
    })),
    relationTypes: RELATION_TYPES.map((t) => ({
      type: t,
      label: RELATION_TYPE_LABELS[t],
    })),
  });
});

apiRouter.get("/stats", async (_req, res, next) => {
  try {
    res.json(await getStats());
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/graph", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 200) || 200, 500);
    const data = q ? await searchGraph(q, limit) : await getGraph(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/entities", async (req, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : undefined;
    res.json(await listEntities(type));
  } catch (err) {
    next(err);
  }
});

apiRouter.delete("/entities/:id", async (req, res, next) => {
  try {
    const ok = await deleteEntity(req.params.id);
    res.json({ deleted: ok });
  } catch (err) {
    next(err);
  }
});

apiRouter.delete("/graph", async (_req, res, next) => {
  try {
    await clearGraph();
    res.json({ cleared: true });
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/documents/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "请上传文件" });
      return;
    }

    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const extracted = await parseDocumentToGraph(req.file.path, originalName);
    const result = await ingestExtractedGraph(extracted, {
      filename: req.file.filename,
      originalName,
    });

    res.json({
      ...result,
      preview: extracted.sourceTextPreview,
      entities: extracted.entities,
      relations: extracted.relations,
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/documents/parse-text", async (req, res, next) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "文本不能为空" });
      return;
    }

    const { extractGraphFromText } = await import("../services/parser.js");
    const extracted = extractGraphFromText(text);
    const originalName = `粘贴文本-${Date.now()}.txt`;
    const result = await ingestExtractedGraph(extracted, {
      filename: originalName,
      originalName,
    });

    res.json({
      ...result,
      preview: extracted.sourceTextPreview,
      entities: extracted.entities,
      relations: extracted.relations,
    });
  } catch (err) {
    next(err);
  }
});
