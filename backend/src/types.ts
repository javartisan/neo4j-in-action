/** 证券 / 大宗交易知识图谱本体 */

export const ENTITY_TYPES = [
  // 原有证券研报本体
  "Company",
  "Stock",
  "Industry",
  "Person",
  "Product",
  "Event",
  "Document",
  // 大宗交易业务本体
  "Business",
  "BlockTrade",
  "Exchange",
  "Security",
  "Fund",
  "ConvertibleBond",
  "GEMStock",
  "Account",
  "CashAccount",
  "CreditAccount",
  "Order",
  "OrderType",
  "OrderStatus",
  "TradingRule",
  "TradingEvent",
  "TradingInterface",
  "Database",
  "DatabaseTable",
  "DatabaseField",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  // 原有关系
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
  // 大宗交易关系（对应 TTL 谓词）
  "APPLIES_TO",
  "SUPPORTS_ORDER_TYPE",
  "SUPPORTS_SECURITY",
  "SECURITY_TYPE",
  "RESULTS_IN",
  "WRITES_TO",
  "QUERIES",
  "LOADS_INTO",
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
  Business: "业务",
  BlockTrade: "大宗交易",
  Exchange: "交易所",
  Security: "证券",
  Fund: "基金",
  ConvertibleBond: "可转债",
  GEMStock: "创业板股票",
  Account: "账户",
  CashAccount: "现货账户",
  CreditAccount: "信用账户",
  Order: "订单",
  OrderType: "订单类型",
  OrderStatus: "订单状态",
  TradingRule: "交易规则",
  TradingEvent: "交易事件",
  TradingInterface: "交易接口",
  Database: "数据库",
  DatabaseTable: "数据表",
  DatabaseField: "数据字段",
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
  APPLIES_TO: "适用于",
  SUPPORTS_ORDER_TYPE: "支持申报方式",
  SUPPORTS_SECURITY: "支持证券",
  SECURITY_TYPE: "证券类型",
  RESULTS_IN: "导致状态",
  WRITES_TO: "写入",
  QUERIES: "查询",
  LOADS_INTO: "上场到",
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
