import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { createRequire } from "node:module";
import { v4 as uuidv4 } from "uuid";
import type {
  EntityType,
  ExtractedGraph,
  KgEntity,
  KgRelation,
  RelationType,
} from "../types.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

/** 常见证券实体词典（可扩展） */
const KNOWN_COMPANIES = [
  "贵州茅台",
  "五粮液",
  "宁德时代",
  "比亚迪",
  "招商银行",
  "中国平安",
  "恒瑞医药",
  "隆基绿能",
  "中芯国际",
  "腾讯控股",
  "阿里巴巴",
  "美团",
  "京东",
  "中国移动",
  "工商银行",
  "建设银行",
  "农业银行",
  "中国石油",
  "中国石化",
  "万科A",
  "海康威视",
  "立讯精密",
  "药明康德",
  "东方财富",
  "中信证券",
  "华泰证券",
];

const KNOWN_INDUSTRIES = [
  "白酒",
  "新能源",
  "新能源汽车",
  "锂电池",
  "半导体",
  "银行",
  "保险",
  "医药",
  "白酒酿造",
  "光伏",
  "互联网",
  "消费电子",
  "证券",
  "房地产",
  "石油石化",
  "通信",
  "人工智能",
  "高端制造",
];

const STOCK_CODE_RE = /(?:股票代码|证券代码|代码)[：:\s]*([036]\d{5})/g;
const BARE_CODE_RE = /\b([036]\d{5})\b/g;

interface StructuredPayload {
  entities?: Array<{
    type: EntityType | string;
    name: string;
    id?: string;
    props?: Record<string, string | number | boolean | null>;
  }>;
  relations?: Array<{
    from: string;
    to: string;
    type: RelationType | string;
    props?: Record<string, string | number | boolean | null>;
  }>;
}

export async function extractTextFromFile(
  filePath: string,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = await readFile(filePath);

  if (ext === ".txt" || ext === ".md" || ext === ".csv") {
    return buffer.toString("utf-8");
  }

  if (ext === ".json") {
    return buffer.toString("utf-8");
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  throw new Error(`暂不支持的文件类型: ${ext || "未知"}`);
}

function upsertEntity(
  map: Map<string, KgEntity>,
  type: EntityType,
  name: string,
  props: Record<string, string | number | boolean | null> = {},
): KgEntity {
  name = name.replace(/的$/u, "").trim();
  if (!name) {
    name = "未知";
  }
  const key = `${type}:${name}`;
  const existing = map.get(key);
  if (existing) {
    existing.props = { ...existing.props, ...props };
    return existing;
  }
  const entity: KgEntity = { id: uuidv4(), type, name, props };
  map.set(key, entity);
  return entity;
}

function addRelation(
  relations: KgRelation[],
  seen: Set<string>,
  from: string,
  to: string,
  type: RelationType,
  props: Record<string, string | number | boolean | null> = {},
) {
  const key = `${from}|${type}|${to}`;
  if (seen.has(key)) return;
  seen.add(key);
  relations.push({ from, to, type, props });
}

/** 从自然语言/研报文本中规则抽取证券实体与关系 */
export function extractGraphFromText(text: string): ExtractedGraph {
  const entityMap = new Map<string, KgEntity>();
  const relations: KgRelation[] = [];
  const seenRel = new Set<string>();
  const clean = text.replace(/\r\n/g, "\n");

  // 股票代码
  for (const match of clean.matchAll(STOCK_CODE_RE)) {
    const code = match[1];
    upsertEntity(entityMap, "Stock", code, { code });
  }
  for (const match of clean.matchAll(BARE_CODE_RE)) {
    const code = match[1];
    upsertEntity(entityMap, "Stock", code, { code });
  }

  // 词典命中
  for (const name of KNOWN_COMPANIES) {
    if (clean.includes(name)) {
      upsertEntity(entityMap, "Company", name);
    }
  }
  for (const name of KNOWN_INDUSTRIES) {
    if (clean.includes(name)) {
      upsertEntity(entityMap, "Industry", name);
    }
  }

  // 公司名模式：XX股份有限公司 / XX有限公司 / XX集团
  const companyPattern =
    /([\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:股份有限公司|有限公司|集团))/g;
  for (const match of clean.matchAll(companyPattern)) {
    upsertEntity(entityMap, "Company", match[1]);
  }

  // 关系模式
  const patterns: Array<{
    re: RegExp;
    build: (m: RegExpMatchArray) => void;
  }> = [
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,15}?)的?股票代码[是为：:\s]*([036]\d{5})/g,
      build: (m) => {
        const company = upsertEntity(entityMap, "Company", m[1]);
        const stock = upsertEntity(entityMap, "Stock", m[2], { code: m[2] });
        addRelation(relations, seenRel, company.name, stock.name, "LISTED_AS");
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})属于([\u4e00-\u9fa5]{2,15})行业/g,
      build: (m) => {
        const company = upsertEntity(entityMap, "Company", m[1]);
        const industry = upsertEntity(entityMap, "Industry", m[2]);
        addRelation(relations, seenRel, company.name, industry.name, "BELONGS_TO");
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})隶属(?:于)?([\u4e00-\u9fa5]{2,15})(?:行业|板块)/g,
      build: (m) => {
        const company = upsertEntity(entityMap, "Company", m[1]);
        const industry = upsertEntity(entityMap, "Industry", m[2]);
        addRelation(relations, seenRel, company.name, industry.name, "BELONGS_TO");
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})的(?:董事长|总经理|CEO|总裁)(?:是|为)([\u4e00-\u9fa5]{2,4})/g,
      build: (m) => {
        const company = upsertEntity(entityMap, "Company", m[1]);
        const person = upsertEntity(entityMap, "Person", m[2], {
          title: m[0].includes("董事长")
            ? "董事长"
            : m[0].includes("总经理")
              ? "总经理"
              : "高管",
        });
        addRelation(relations, seenRel, company.name, person.name, "HAS_EXECUTIVE");
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})控股([\u4e00-\u9fa5A-Za-z0-9]{2,20})/g,
      build: (m) => {
        const a = upsertEntity(entityMap, "Company", m[1]);
        const b = upsertEntity(entityMap, "Company", m[2]);
        addRelation(relations, seenRel, a.name, b.name, "CONTROLS");
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})持有([\u4e00-\u9fa5A-Za-z0-9]{2,20})(?:约)?(\d+(?:\.\d+)?)%/g,
      build: (m) => {
        const a = upsertEntity(entityMap, "Company", m[1]);
        const b = upsertEntity(entityMap, "Company", m[2]);
        addRelation(relations, seenRel, a.name, b.name, "HOLDS_SHARE", {
          ratio: Number(m[3]),
        });
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})主营(?:业务)?[是为：:\s]*([\u4e00-\u9fa5A-Za-z0-9、，,]{2,40})/g,
      build: (m) => {
        const company = upsertEntity(entityMap, "Company", m[1]);
        const products = m[2].split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
        for (const p of products) {
          const product = upsertEntity(entityMap, "Product", p);
          addRelation(relations, seenRel, company.name, product.name, "PRODUCES");
        }
      },
    },
    {
      re: /([\u4e00-\u9fa5A-Za-z0-9]{2,20})与([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?:存在竞争|竞争)/g,
      build: (m) => {
        const a = upsertEntity(entityMap, "Company", m[1]);
        const b = upsertEntity(entityMap, "Company", m[2]);
        addRelation(relations, seenRel, a.name, b.name, "COMPETES_WITH");
      },
    },
    {
      re: /([\u4e00-\u9fa5]{2,24}(?:上市|重组|并购|定增|回购|减持|增持)事件)/g,
      build: (m) => {
        upsertEntity(entityMap, "Event", m[1]);
      },
    },
  ];

  for (const { re, build } of patterns) {
    for (const match of clean.matchAll(re)) {
      build(match);
    }
  }

  // 公司与同段落行业的弱关联
  const companies = [...entityMap.values()].filter((e) => e.type === "Company");
  const industries = [...entityMap.values()].filter((e) => e.type === "Industry");
  if (companies.length === 1 && industries.length === 1) {
    addRelation(
      relations,
      seenRel,
      companies[0].name,
      industries[0].name,
      "BELONGS_TO",
    );
  }

  // 公司与股票代码弱关联（同文仅一对时）
  const stocks = [...entityMap.values()].filter((e) => e.type === "Stock");
  if (companies.length === 1 && stocks.length === 1) {
    addRelation(relations, seenRel, companies[0].name, stocks[0].name, "LISTED_AS");
  }

  return {
    entities: [...entityMap.values()],
    relations,
    sourceTextPreview: clean.slice(0, 500),
  };
}

export function extractGraphFromJson(raw: string): ExtractedGraph {
  const payload = JSON.parse(raw) as StructuredPayload;
  const entityMap = new Map<string, KgEntity>();
  const relations: KgRelation[] = [];
  const seenRel = new Set<string>();

  for (const e of payload.entities ?? []) {
    const type = e.type as EntityType;
    upsertEntity(entityMap, type, e.name, e.props ?? {});
  }

  const nameToEntity = new Map<string, KgEntity>();
  for (const e of entityMap.values()) {
    nameToEntity.set(e.name, e);
  }

  for (const r of payload.relations ?? []) {
    if (!nameToEntity.has(r.from) || !nameToEntity.has(r.to)) continue;
    addRelation(relations, seenRel, r.from, r.to, r.type as RelationType, r.props ?? {});
  }

  return {
    entities: [...entityMap.values()],
    relations,
    sourceTextPreview: raw.slice(0, 500),
  };
}

export async function parseDocumentToGraph(
  filePath: string,
  originalName: string,
): Promise<ExtractedGraph> {
  const text = await extractTextFromFile(filePath, originalName);
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".json") {
    return extractGraphFromJson(text);
  }

  return extractGraphFromText(text);
}
