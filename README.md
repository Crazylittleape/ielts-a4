# 雅思词汇艾宾浩斯电子 A4 纸工作台

纯静态 PWA，无后端。仓库根目录保留已发布版本；`app/` 是恢复并继续开发的 v3 源码。开发与交接见 [docs/CONTINUE.md](docs/CONTINUE.md)。

v3 先在 `app/` 执行 `npm ci && npm test && npm run build`，预览通过后发布 `app/dist/` 的全部文件。不要把源码目录直接当成新版本部署包。

## 部署到 GitHub Pages（一次性，约 3 分钟）

1. GitHub 右上角「+」→ **New repository**，仓库名填 `ielts-a4`（可改），选 **Public**，不要勾选任何初始化文件，点 Create。
2. 在新仓库页面点 **uploading an existing file**，把本压缩包解压后的**所有文件**（含 `.nojekyll`，解压后它是隐藏文件，Mac 按 ⌘⇧. 显示）一起拖进去 → 下方点 **Commit changes**。
3. 仓库顶部 **Settings** → 左侧 **Pages** → Source 选 **Deploy from a branch** → Branch 选 `main` / `/(root)` → Save。
4. 等 1～2 分钟刷新该页面，顶部会出现网址：`https://<你的用户名>.github.io/ielts-a4/`

## 安装到 iPhone

用 **Safari** 打开上面的网址 → 底部「分享」→ **添加到主屏幕**。之后点桌面图标即可全屏使用，离线也能打开。

## 以后更新

新版本需发布构建产物的全部文件（包括 `sw.js`、图标、manifest 和许可声明），保留 `.nojekyll`，并为每次发布更新缓存版本。请先在「词库」页下载 JSON 备份；v3 会把旧数据迁移到 IndexedDB，详情见交接文档。
