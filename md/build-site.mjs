#!/usr/bin/env node
/**
 * 将 md/ 下的 Markdown 笔记编译为可静态部署的 HTML 站点。
 *
 * 用法：
 *   cd md && npm install && npm run build
 * 产物目录：
 *   md/site/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = path.join(ROOT, "site");
const ASSETS_SRC = path.join(ROOT, "assets");
const ASSETS_OUT = path.join(OUT, "assets");

/** 参与建站的 Markdown（按导航顺序） */
const PAGES = [
  {
    md: "知识图谱-KG技术体系.md",
    html: "index.html",
    title: "知识图谱 · 七大技术方向",
    nav: "总览",
  },
  {
    md: "1、知识表示-精炼学习笔记.md",
    html: "1-知识表示.html",
    title: "1、知识表示",
    nav: "1 表示",
  },
  {
    md: "2、知识获取-精炼学习笔记.md",
    html: "2-知识获取.html",
    title: "2、知识获取",
    nav: "2 获取",
  },
  {
    md: "3、知识存储-精炼学习笔记.md",
    html: "3-知识存储.html",
    title: "3、知识存储",
    nav: "3 存储",
  },
  {
    md: "4、知识推理-精炼学习笔记.md",
    html: "4-知识推理.html",
    title: "4、知识推理",
    nav: "4 推理",
  },
  {
    md: "5、知识融合-精炼学习笔记.md",
    html: "5-知识融合.html",
    title: "5、知识融合",
    nav: "5 融合",
  },
  {
    md: "6、知识问答-精炼学习笔记.md",
    html: "6-知识问答.html",
    title: "6、知识问答",
    nav: "6 问答",
  },
  {
    md: "7、知识分析-精炼学习笔记.md",
    html: "7-知识分析.html",
    title: "7、知识分析",
    nav: "7 分析",
  },
];

marked.setOptions({
  gfm: true,
  breaks: false,
});

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Markdown 内链 .md → 对应 .html */
function rewriteMdLinks(markdown) {
  const map = new Map();
  for (const p of PAGES) {
    map.set(p.md, p.html);
    // 兼容笔记里的相对链接写法
    map.set(`./${p.md}`, p.html);
  }
  // 额外：部分链接写成短标题
  map.set("./1、知识表示-精炼学习笔记.md", "1-知识表示.html");
  map.set("./2、知识获取-精炼学习笔记.md", "2-知识获取.html");
  map.set("./3、知识存储-精炼学习笔记.md", "3-知识存储.html");
  map.set("./4、知识推理-精炼学习笔记.md", "4-知识推理.html");
  map.set("./5、知识融合-精炼学习笔记.md", "5-知识融合.html");
  map.set("./6、知识问答-精炼学习笔记.md", "6-知识问答.html");
  map.set("./7、知识分析-精炼学习笔记.md", "7-知识分析.html");

  return markdown.replace(/\]\(([^)]+\.md)\)/g, (full, href) => {
    const key = href.trim();
    const base = path.posix.basename(key);
    const target =
      map.get(key) ||
      map.get(`./${base}`) ||
      map.get(base) ||
      PAGES.find((p) => p.md === base)?.html;
    if (!target) return full;
    return `](${target})`;
  });
}

function renderNav(currentHtml) {
  return PAGES.map((p) => {
    const cls = p.html === currentHtml ? ' class="active"' : "";
    return `<a href="${p.html}"${cls}>${escapeHtml(p.nav)}</a>`;
  }).join("\n          ");
}

function renderPager(index) {
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  const left = prev
    ? `<a href="${prev.html}">← ${escapeHtml(prev.nav)}</a>`
    : "<span></span>";
  const right = next
    ? `<a href="${next.html}">${escapeHtml(next.nav)} →</a>`
    : "<span></span>";
  return `<nav class="pager">${left}${right}</nav>`;
}

function pageTemplate({ title, currentHtml, bodyHtml, pagerHtml }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} · 证券知识图谱</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&family=Sora:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/site.css" />
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="index.html">知识图谱 KG</a>
      <nav class="nav">
          ${renderNav(currentHtml)}
      </nav>
    </div>
  </header>
  <main class="wrap">
    <article class="article">
      ${bodyHtml}
      ${pagerHtml}
    </article>
  </main>
  <footer class="footer">
    由 <code>md/build-site.mjs</code> 从 Markdown 生成 · 可直接静态部署 <code>md/site/</code>
  </footer>
</body>
</html>
`;
}

function copyAssets() {
  ensureDir(ASSETS_OUT);
  for (const name of fs.readdirSync(ASSETS_SRC)) {
    fs.copyFileSync(path.join(ASSETS_SRC, name), path.join(ASSETS_OUT, name));
  }
}

function copyExamples() {
  const src = path.join(ROOT, "examples");
  if (!fs.existsSync(src)) return;
  const dest = path.join(OUT, "examples");
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}

function build() {
  ensureDir(OUT);
  copyAssets();
  copyExamples();

  let built = 0;
  for (let i = 0; i < PAGES.length; i++) {
    const page = PAGES[i];
    const mdPath = path.join(ROOT, page.md);
    if (!fs.existsSync(mdPath)) {
      console.warn(`跳过（文件不存在）: ${page.md}`);
      continue;
    }
    const raw = fs.readFileSync(mdPath, "utf8");
    const rewritten = rewriteMdLinks(raw);
    // examples 链接保持相对路径
    const withExamples = rewritten.replace(
      /\]\(\.\/examples\//g,
      "](examples/",
    );
    const bodyHtml = marked.parse(withExamples);
    const html = pageTemplate({
      title: page.title,
      currentHtml: page.html,
      bodyHtml,
      pagerHtml: renderPager(i),
    });
    fs.writeFileSync(path.join(OUT, page.html), html, "utf8");
    built += 1;
    console.log(`✓ ${page.md} → site/${page.html}`);
  }

  console.log(`\n完成：共 ${built} 页 → ${OUT}`);
  console.log("预览：可直接打开 site/index.html，或执行 npx serve site");
}

build();
