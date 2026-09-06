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

export interface Stats {
  entities: number;
  relations: number;
  documents: number;
  byType: Record<string, number>;
}

export interface UploadResult {
  documentId: string;
  entityCount: number;
  relationCount: number;
  preview: string;
  entities: Array<{ id: string; type: string; name: string }>;
  relations: Array<{ from: string; to: string; type: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

export const api = {
  stats: () => request<Stats>("/api/stats"),
  graph: (q?: string) =>
    request<GraphData>(q ? `/api/graph?q=${encodeURIComponent(q)}` : "/api/graph"),
  entities: (type?: string) =>
    request<GraphNode[]>(
      type ? `/api/entities?type=${encodeURIComponent(type)}` : "/api/entities",
    ),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>("/api/documents/upload", {
      method: "POST",
      body: form,
    });
  },
  parseText: (text: string) =>
    request<UploadResult>("/api/documents/parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  clear: () => request<{ cleared: boolean }>("/api/graph", { method: "DELETE" }),
  ontology: () =>
    request<{
      entityTypes: Array<{ type: string; label: string }>;
      relationTypes: Array<{ type: string; label: string }>;
    }>("/api/ontology"),
};
