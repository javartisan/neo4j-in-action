# 知识图谱文档静态站

将本目录 Markdown 编译为可部署的 HTML。

## 构建

```bash
cd md
npm install
npm run build
```

产物在 `site/`：

- `site/index.html` — 七大方向总览
- `site/1-知识表示.html` … `site/7-知识分析.html`
- `site/assets/site.css`
- `site/examples/` — 示例文件（如 OWL `.ttl`）

## 本地预览

```bash
npx --yes serve site
# 或直接用浏览器打开 site/index.html
```

## 部署

把整个 `site/` 目录上传到任意静态托管即可，例如：

- Nginx / Apache 静态目录
- GitHub Pages / Cloudflare Pages / OSS

根路径指向 `site/index.html`。

## 脚本说明

| 文件 | 作用 |
|------|------|
| `build-site.mjs` | 转换 Markdown → HTML，重写 `.md` 内链为 `.html` |
| `assets/site.css` | 站点样式 |
| `package.json` | 依赖 `marked` |
