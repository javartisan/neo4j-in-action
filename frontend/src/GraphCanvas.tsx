import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode } from "./api";

const TYPE_COLORS: Record<string, string> = {
  Company: "#0f766e",
  Stock: "#1d4ed8",
  Industry: "#b45309",
  Person: "#7c3aed",
  Product: "#047857",
  Event: "#be123c",
  Document: "#475569",
};

interface FgNode {
  id: string;
  name: string;
  type: string;
  color: string;
  raw: GraphNode;
  x?: number;
  y?: number;
}

interface FgLink {
  source: string;
  target: string;
  type: string;
}

interface Props {
  data: GraphData;
  onSelect: (node: GraphNode | null) => void;
}

export function GraphCanvas({ data, onSelect }: Props) {
  const fgRef = useRef<
    | {
        d3Force: (
          name: string,
        ) => { strength?: (n: number) => unknown; distance?: (n: number) => unknown } | undefined;
      }
    | undefined
  >(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const graph = useMemo(() => {
    const nodes: FgNode[] = data.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      color: TYPE_COLORS[n.type] ?? "#334155",
      raw: n,
    }));
    const idSet = new Set(nodes.map((n) => n.id));
    const links: FgLink[] = data.edges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      }));
    return { nodes, links };
  }, [data]);

  const paintNode = useCallback(
    (node: FgNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = Math.max(12 / globalScale, 3);
      const r = Math.max(4, 8 / Math.sqrt(globalScale));
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();

      if (globalScale > 0.55) {
        ctx.font = `${fontSize}px Sora, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#0c1222";
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 1);
      }
    },
    [],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-120);
    fg.d3Force("link")?.distance?.(70);
  }, [graph]);

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <ForceGraph2D
        ref={fgRef as never}
        width={size.w}
        height={size.h}
        graphData={graph}
        nodeCanvasObject={paintNode as never}
        nodePointerAreaPaint={((node: FgNode, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }) as never}
        linkColor={() => "rgba(15, 23, 42, 0.28)"}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(node) => onSelect((node as FgNode).raw)}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={80}
      />
    </div>
  );
}
