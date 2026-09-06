import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type GraphData, type GraphNode, type Stats, type UploadResult } from "./api";
import { GraphCanvas } from "./GraphCanvas";
import { formatPropValue, relationLabel, typeLabel } from "./labels";

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [entities, setEntities] = useState<GraphNode[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [tab, setTab] = useState<"upload" | "text" | "entities">("upload");

  const refresh = useCallback(async (q?: string) => {
    const [s, g, e] = await Promise.all([
      api.stats(),
      api.graph(q),
      api.entities(),
    ]);
    setStats(s);
    setGraph(g);
    setEntities(e);
  }, []);

  useEffect(() => {
    refresh().catch((err: Error) => setMessage(err.message));
  }, [refresh]);

  const selectedRelations = useMemo(() => {
    if (!selected) return [];
    return graph.edges
      .map((e) => {
        const source = graph.nodes.find((n) => n.id === e.source);
        const target = graph.nodes.find((n) => n.id === e.target);
        if (!source || !target) return null;
        if (source.id !== selected.id && target.id !== selected.id) return null;
        return {
          id: e.id,
          label: relationLabel(e.type),
          type: e.type,
          from: source.name,
          to: target.name,
          outbound: source.id === selected.id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [selected, graph]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.upload(file);
      setLastUpload(result);
      setMessage(
        `已解析「${file.name}」：实体 ${result.entityCount}，关系 ${result.relationCount}`,
      );
      await refresh(query || undefined);
      setTab("entities");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function onParseText() {
    if (!text.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.parseText(text);
      setLastUpload(result);
      setMessage(`文本入库：实体 ${result.entityCount}，关系 ${result.relationCount}`);
      setText("");
      await refresh(query || undefined);
      setTab("entities");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await refresh(query.trim() || undefined);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "查询失败");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    if (!confirm("确认清空整个知识图谱？此操作不可恢复。")) return;
    setBusy(true);
    try {
      await api.clear();
      setSelected(null);
      setLastUpload(null);
      setMessage("图谱已清空");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "清空失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-inner">
          <p className="brand">Securities Knowledge Graph</p>
          <h1>证券知识图谱</h1>
          <p className="lede">
            上传研报与公告，自动抽取公司、股票、行业、高管与股权关系，构建可检索的 Neo4j 图谱。
          </p>
          <div className="hero-actions">
            <label className="btn primary">
              {busy ? "处理中…" : "上传文档构建图谱"}
              <input
                type="file"
                hidden
                accept=".txt,.md,.json,.csv,.pdf,.docx"
                disabled={busy}
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <button className="btn ghost" type="button" onClick={onClear} disabled={busy}>
              清空图谱
            </button>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside className="panel side">
          <div className="stats">
            <div>
              <strong>{stats?.entities ?? "—"}</strong>
              <span>实体</span>
            </div>
            <div>
              <strong>{stats?.relations ?? "—"}</strong>
              <span>关系</span>
            </div>
            <div>
              <strong>{stats?.documents ?? "—"}</strong>
              <span>文档</span>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={tab === "upload" ? "active" : ""}
              onClick={() => setTab("upload")}
            >
              上传
            </button>
            <button
              type="button"
              className={tab === "text" ? "active" : ""}
              onClick={() => setTab("text")}
            >
              粘贴文本
            </button>
            <button
              type="button"
              className={tab === "entities" ? "active" : ""}
              onClick={() => setTab("entities")}
            >
              实体
            </button>
          </div>

          {tab === "upload" && (
            <div className="block">
              <h2>文档入库</h2>
              <p className="hint">
                支持 txt / md / json / csv / pdf / docx。JSON 可显式声明实体与关系；文本将按证券领域规则抽取。
              </p>
              <p className="hint">样例：<code>samples/证券研报样例.txt</code></p>
              <label className="drop">
                <span>拖拽或点击选择文件</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.csv,.pdf,.docx"
                  disabled={busy}
                  onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          {tab === "text" && (
            <div className="block">
              <h2>粘贴研报片段</h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="例如：贵州茅台属于白酒行业，股票代码是600519。贵州茅台的董事长是丁雄军。"
                rows={10}
              />
              <button className="btn primary wide" type="button" disabled={busy} onClick={onParseText}>
                解析并写入图谱
              </button>
            </div>
          )}

          {tab === "entities" && (
            <div className="block">
              <h2>实体列表</h2>
              <ul className="entity-list">
                {entities.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setSelected(e)}>
                      <span className={`tag type-${e.type}`}>{typeLabel(e.type)}</span>
                      <span>{e.name}</span>
                    </button>
                  </li>
                ))}
                {entities.length === 0 && <li className="empty">暂无实体，请先上传文档</li>}
              </ul>
            </div>
          )}

          {message && <p className="toast">{message}</p>}

          {lastUpload && (
            <div className="block muted">
              <h2>最近抽取</h2>
              <ul className="mini">
                {lastUpload.relations.slice(0, 8).map((r, i) => (
                  <li key={`${r.from}-${r.type}-${r.to}-${i}`}>
                    {r.from} <em>{relationLabel(r.type)}</em> {r.to}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="panel graph-panel">
          <form className="toolbar" onSubmit={onSearch}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索公司 / 行业 / 人物…"
            />
            <button className="btn primary" type="submit" disabled={busy}>
              检索
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setQuery("");
                refresh().catch((err: Error) => setMessage(err.message));
              }}
            >
              重置
            </button>
          </form>

          <GraphCanvas data={graph} onSelect={setSelected} />

          <aside className={`detail ${selected ? "open" : ""}`}>
            {selected ? (
              <>
                <p className={`tag type-${selected.type}`}>
                  {typeLabel(selected.type)}
                </p>
                <h3>{selected.name}</h3>
                <dl>
                  {Object.entries(selected.properties)
                    .filter(([k]) => !["id", "name", "entityType"].includes(k))
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{formatPropValue(v)}</dd>
                      </div>
                    ))}
                </dl>
                {selectedRelations.length > 0 && (
                  <div className="rel-list">
                    <h4>关系</h4>
                    <ul className="mini">
                      {selectedRelations.map((r) => (
                        <li key={r.id}>
                          {r.outbound ? (
                            <>
                              → <em>{r.label}</em> {r.to}
                            </>
                          ) : (
                            <>
                              ← <em>{r.label}</em> {r.from}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="hint">点击节点查看详情</p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
