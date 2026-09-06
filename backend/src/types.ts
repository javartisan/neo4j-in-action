/** 证券知识图谱本体 */

export const ENTITY_TYPES = [
  "Company",
  "Stock",
  "Industry",
  "Person",
  "Product",
  "Event",
  "Document",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  "LISTED_AS",
  "BELONGS_TO",
  "HAS_EXECUTIVE",
  "PRODUCES",
  "CONTROLS",
  "HOLDS_SHARE",
  "COMPETES_WITH",
  "INVOLVES",
  "MENTIONS",
  "RELATED_TO",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  Company: "公司",
  Stock: "股票",
  Industry: "行业",
  Person: "人物",
  Product: "产品",
  Event: "事件",
  Document: "文档",
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  LISTED_AS: "上市为",
  BELONGS_TO: "属于",
  HAS_EXECUTIVE: "高管",
  PRODUCES: "生产",
  CONTROLS: "控股",
  HOLDS_SHARE: "持股",
  COMPETES_WITH: "竞争",
  INVOLVES: "涉及",
  MENTIONS: "提及",
  RELATED_TO: "相关",
};

export interface KgEntity {
  id: string;
  type: EntityType;
  name: string;
  props?: Record<string, string | number | boolean | null>;
}

export interface KgRelation {
  from: string;
  to: string;
  type: RelationType;
  props?: Record<string, string | number | boolean | null>;
}

export interface ExtractedGraph {
  entities: KgEntity[];
  relations: KgRelation[];
  sourceTextPreview: string;
}

export interface GraphNode {
  id: string;
  labels: string[];
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
