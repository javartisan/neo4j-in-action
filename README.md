# 证券知识图谱（B/S）

上传证券研报/公告文档 → 解析抽取实体关系 → 写入 Neo4j → 浏览器可视化检索。

## 架构

```
Browser (React + Vite)
    │  /api/*
Backend (Express + TypeScript)
    │  Bolt
Neo4j
```

### 本体

| 实体 | 说明 |
|------|------|
| Company | 公司 |
| Stock | 股票代码 |
| Industry | 行业 |
| Person | 高管/人物 |
| Product | 产品/业务 |
| Event | 事件 |
| Document | 来源文档 |

关系：`LISTED_AS` / `BELONGS_TO` / `HAS_EXECUTIVE` / `PRODUCES` / `CONTROLS` / `HOLDS_SHARE` / `COMPETES_WITH` / `INVOLVES` / `MENTIONS` 等。

## 快速启动

### 1. Neo4j

确保 Neo4j 已启动（本仓库 `docker compose up -d`，或使用已有实例）。配置见 `backend/.env`：

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
PORT=3001
```

### 2. 安装并启动

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001/api

### 3. 试用样例

上传 `samples/证券研报样例.txt` 或 `samples/证券图谱样例.json`，即可在画布看到图谱。

也可在「粘贴文本」中输入：

```text
贵州茅台属于白酒行业，股票代码是600519。贵州茅台的董事长是丁雄军。
```

## 目录

```
backend/     Express API、文档解析、图谱写入
frontend/    React 可视化界面
samples/     样例研报与结构化 JSON
docker-compose.yml
```

## 文档解析说明

- **文本/PDF/DOCX**：规则抽取（股票代码、公司名、行业、高管、控股/持股、竞争、主营等）
- **JSON**：显式 `entities` + `relations`，适合批量/精确入库

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/graph?q=` | 全图 / 关键词检索 |
| GET | `/api/stats` | 统计 |
| GET | `/api/entities` | 实体列表 |
| POST | `/api/documents/upload` | 上传文档构建图谱 |
| POST | `/api/documents/parse-text` | 粘贴文本构建图谱 |
| DELETE | `/api/graph` | 清空图谱 |
