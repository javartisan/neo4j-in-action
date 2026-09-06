/** 与后端 ontology 对齐的中文标签 */

export const TYPE_LABELS: Record<string, string> = {
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

export const RELATION_LABELS: Record<string, string> = {
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

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function relationLabel(type: string): string {
  return RELATION_LABELS[type] ?? type;
}
