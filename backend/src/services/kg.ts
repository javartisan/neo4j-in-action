import neo4j from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { getDriver, toNumber } from "../db.js";
import type {
  ExtractedGraph,
  GraphData,
  GraphEdge,
  GraphNode,
  KgEntity,
  KgRelation,
} from "../types.js";

function sanitizeLabel(label: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(label)) {
    throw new Error(`非法节点标签: ${label}`);
  }
  return label;
}

function sanitizeRelType(type: string): string {
  if (!/^[A-Z][A-Z0-9_]*$/.test(type)) {
    throw new Error(`非法关系类型: ${type}`);
  }
  return type;
}

export async function ensureConstraints(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(`
      CREATE CONSTRAINT entity_id IF NOT EXISTS
      FOR (n:Entity) REQUIRE n.id IS UNIQUE
    `);
  } catch (err) {
    console.warn("约束创建跳过:", err);
  } finally {
    await session.close();
  }
}

export async function ingestExtractedGraph(
  graph: ExtractedGraph,
  documentMeta: { filename: string; originalName: string },
): Promise<{ documentId: string; entityCount: number; relationCount: number }> {
  const session = getDriver().session();
  const documentId = uuidv4();

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
        MERGE (d:Entity:Document {name: $name, entityType: 'Document'})
        ON CREATE SET d.id = $id, d.createdAt = datetime(), d.filename = $filename
        ON MATCH SET d.id = coalesce(d.id, $id), d.filename = $filename, d.updatedAt = datetime()
        SET d.preview = $preview
        `,
        {
          id: documentId,
          name: documentMeta.originalName,
          filename: documentMeta.filename,
          preview: graph.sourceTextPreview,
        },
      );

      for (const entity of graph.entities) {
        await mergeEntity(tx, entity);
        await tx.run(
          `
          MATCH (d:Entity:Document {name: $docName})
          MATCH (e:Entity {name: $name, entityType: $type})
          MERGE (d)-[r:MENTIONS]->(e)
          SET r.updatedAt = datetime()
          `,
          {
            docName: documentMeta.originalName,
            name: entity.name,
            type: entity.type,
          },
        );
      }

      for (const rel of graph.relations) {
        await mergeRelation(tx, rel, graph.entities);
      }
    });

    return {
      documentId,
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
    };
  } finally {
    await session.close();
  }
}

async function mergeEntity(
  tx: { run: (q: string, p?: Record<string, unknown>) => Promise<unknown> },
  entity: KgEntity,
) {
  const label = sanitizeLabel(entity.type);
  await tx.run(
    `
    MERGE (e:Entity:${label} {name: $name, entityType: $type})
    ON CREATE SET e.id = $id, e.createdAt = datetime()
    ON MATCH SET e.id = coalesce(e.id, $id), e.updatedAt = datetime()
    SET e += $props
    `,
    {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      props: entity.props ?? {},
    },
  );
}

async function mergeRelation(
  tx: { run: (q: string, p?: Record<string, unknown>) => Promise<unknown> },
  rel: KgRelation,
  entities: KgEntity[],
) {
  const type = sanitizeRelType(rel.type);
  const fromEntity = entities.find((e) => e.name === rel.from);
  const toEntity = entities.find((e) => e.name === rel.to);
  if (!fromEntity || !toEntity) return;

  await tx.run(
    `
    MATCH (a:Entity {name: $fromName, entityType: $fromType})
    MATCH (b:Entity {name: $toName, entityType: $toType})
    MERGE (a)-[r:${type}]->(b)
    SET r += $props, r.updatedAt = datetime()
    `,
    {
      fromName: fromEntity.name,
      fromType: fromEntity.type,
      toName: toEntity.name,
      toType: toEntity.type,
      props: rel.props ?? {},
    },
  );
}

export async function getGraph(limit = 200): Promise<GraphData> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (n:Entity)
      WITH n LIMIT $limit
      OPTIONAL MATCH (n)-[r]->(m:Entity)
      RETURN n, r, m
      `,
      { limit: neo4jInt(limit) },
    );

    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();

    for (const record of result.records) {
      const n = record.get("n");
      if (n) {
        nodes.set(n.elementId, toGraphNode(n));
      }
      const m = record.get("m");
      const r = record.get("r");
      if (m) nodes.set(m.elementId, toGraphNode(m));
      if (r && n && m) {
        edges.set(r.elementId, {
          id: r.elementId,
          type: r.type,
          source: n.elementId,
          target: m.elementId,
          properties: r.properties ?? {},
        });
      }
    }

    // 补齐孤立节点：再查一轮仅节点
    if (nodes.size === 0) {
      const onlyNodes = await session.run(
        `MATCH (n:Entity) RETURN n LIMIT $limit`,
        { limit: neo4jInt(limit) },
      );
      for (const record of onlyNodes.records) {
        const n = record.get("n");
        nodes.set(n.elementId, toGraphNode(n));
      }
    }

    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  } finally {
    await session.close();
  }
}

export async function searchGraph(keyword: string, limit = 100): Promise<GraphData> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (n:Entity)
      WHERE toLower(coalesce(n.name, '')) CONTAINS toLower($keyword)
         OR toLower(coalesce(n.entityType, '')) CONTAINS toLower($keyword)
      WITH n LIMIT $limit
      OPTIONAL MATCH (n)-[r]-(m:Entity)
      RETURN n, r, m
      `,
      { keyword, limit: neo4jInt(limit) },
    );

    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();

    for (const record of result.records) {
      const n = record.get("n");
      const m = record.get("m");
      const r = record.get("r");
      if (n) nodes.set(n.elementId, toGraphNode(n));
      if (m) nodes.set(m.elementId, toGraphNode(m));
      if (r && n && m) {
        const start = r.startNodeElementId ?? n.elementId;
        const end = r.endNodeElementId ?? m.elementId;
        edges.set(r.elementId, {
          id: r.elementId,
          type: r.type,
          source: start,
          target: end,
          properties: r.properties ?? {},
        });
      }
    }

    return { nodes: [...nodes.values()], edges: [...edges.values()] };
  } finally {
    await session.close();
  }
}

export async function listEntities(type?: string): Promise<GraphNode[]> {
  const session = getDriver().session();
  try {
    const result = type
      ? await session.run(
          `
          MATCH (n:Entity {entityType: $type})
          RETURN n
          ORDER BY n.name
          LIMIT 500
          `,
          { type },
        )
      : await session.run(
          `
          MATCH (n:Entity)
          WHERE n.entityType <> 'Document'
          RETURN n
          ORDER BY n.entityType, n.name
          LIMIT 500
          `,
        );

    return result.records.map((r) => toGraphNode(r.get("n")));
  } finally {
    await session.close();
  }
}

export async function getStats(): Promise<{
  entities: number;
  relations: number;
  documents: number;
  byType: Record<string, number>;
}> {
  const session = getDriver().session();
  try {
    const entityRes = await session.run(
      `MATCH (n:Entity) WHERE n.entityType <> 'Document' RETURN count(n) AS c`,
    );
    const relRes = await session.run(
      `MATCH (:Entity)-[r]->(:Entity) WHERE type(r) <> 'MENTIONS' RETURN count(r) AS c`,
    );
    const docRes = await session.run(`MATCH (n:Document) RETURN count(n) AS c`);
    const typeRes = await session.run(`
      MATCH (n:Entity)
      WHERE n.entityType <> 'Document'
      RETURN n.entityType AS type, count(*) AS c
    `);

    const byType: Record<string, number> = {};
    for (const record of typeRes.records) {
      byType[String(record.get("type"))] = toNumber(record.get("c"));
    }

    return {
      entities: toNumber(entityRes.records[0]?.get("c")),
      relations: toNumber(relRes.records[0]?.get("c")),
      documents: toNumber(docRes.records[0]?.get("c")),
      byType,
    };
  } finally {
    await session.close();
  }
}

export async function clearGraph(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(`MATCH (n:Entity) DETACH DELETE n`);
  } finally {
    await session.close();
  }
}

export async function deleteEntity(id: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (n:Entity {id: $id})
      DETACH DELETE n
      RETURN count(n) AS c
      `,
      { id },
    );
    return toNumber(result.records[0]?.get("c")) > 0;
  } finally {
    await session.close();
  }
}

function toGraphNode(node: {
  elementId: string;
  labels: string[];
  properties: Record<string, unknown>;
}): GraphNode {
  const labels = node.labels.filter((l) => l !== "Entity");
  return {
    id: node.elementId,
    labels: node.labels,
    name: String(node.properties.name ?? ""),
    type: String(node.properties.entityType ?? labels[0] ?? "Entity"),
    properties: node.properties,
  };
}

function neo4jInt(n: number) {
  return neo4j.int(Math.floor(n));
}
