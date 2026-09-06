import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode } from "./api";
import { relationLabel } from "./labels";

const TYPE_COLORS: Record<string, string> = {
  Company: "#0f766e",
  Stock: "#1d4ed8",
  Industry: "#b45309",
  Person: "#7c3aed",
  Product: "#047857",
  Event: "#be123c",
  Document: "#475569",
  BlockTrade: "#0f766e",
  Exchange: "#1d4ed8",
  Fund: "#047857",
  ConvertibleBond: "#b45309",
  GEMStock: "#7c3aed",
  CashAccount: "#0e7490",
  CreditAccount: "#c2410c",
  OrderType: "#0369a1",
  OrderStatus: "#4c1d95",
  TradingRule: "#a16207",
  TradingEvent: "#be123c",
  TradingInterface: "#115e59",
  Database: "#334155",
  DatabaseTable: "#475569",
  DatabaseField: "#64748b",
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
  source: string | FgNode;
  target: string | FgNode;
  type: string;
  label: string;
}

interface Props {
  data: GraphData;
  onSelect: (node: GraphNode | null) => void;
}

function nodePos(n: string | FgNode): { x: number; y: number } {
  if (typeof n === "string") return { x: 0, y: 0 };
  return { x: n.x ?? 0, y: n.y ?? 0 };
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
        label: relationLabel(e.type),
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
        ctx.font = `${fontSize}px Sora, "PingFang SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#0c1222";
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 1);
      }
    },
    [],
  );

  const paintLink = useCallback(
    (link: FgLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (globalScale < 0.7) return;
      const start = nodePos(link.source);
      const end = nodePos(link.target);
      const x = (start.x + end.x) / 2;
      const y = (start.y + end.y) / 2;
      const fontSize = Math.max(10 / globalScale, 2.5);
      ctx.font = `${fontSize}px Sora, "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = link.label;
      const padX = 3 / globalScale;
      const padY = 1.5 / globalScale;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(244, 240, 232, 0.88)";
      ctx.fillRect(x - tw / 2 - padX, y - fontSize / 2 - padY, tw + padX * 2, fontSize + padY * 2);
      ctx.fillStyle = "#0f766e";
      ctx.fillText(text, x, y);
    },
    [],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-120);
    fg.d3Force("link")?.distance?.(90);
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
        linkCanvasObjectMode={() => "after"}
        linkCanvasObject={paintLink as never}
        linkColor={() => "rgba(15, 23, 42, 0.28)"}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkLabel={(link) => (link as FgLink).label}
        onNodeClick={(node) => onSelect((node as FgNode).raw)}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={80}
      />
    </div>
  );
}
