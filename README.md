# alun reader

alun reader 是一个跨平台桌面 Markdown 阅读和编辑工具，支持 Markdown 预览、代码高亮、Mermaid 图表、Zen 投屏模式和本地文件保存。

## 当前版本

- 版本：`1.0.0`
- 版本说明：见 [CHANGELOG.md](./CHANGELOG.md)
- 许可证：`PolyForm-Noncommercial-1.0.0`，仅允许非商业用途

## 功能

- Markdown 编辑和实时预览
- Mermaid 图表渲染、缩放、重置和全屏查看
- 浅色、深色、跟随系统主题
- Zen 模式，只保留预览内容，适合投屏讲解
- 真实文件操作：新建窗口、导入、保存、另存为
- 最近打开文件列表，桌面端会持久保存
- 应用内 GitHub Release 更新检查，发现新版后可下载并打开当前平台安装包
- GitHub Pages 发布页
- macOS、Windows、Linux 桌面端打包配置

## 本地运行

前置要求：

- Node.js
- npm

安装依赖：

```bash
npm install
```

启动 Web 开发服务：

```bash
npm run dev
```

启动桌面端：

```bash
npm run desktop
```

## 桌面端使用说明

文件菜单：

- `新建窗口`：打开一个独立编辑窗口
- `导入...`：在当前窗口打开 Markdown 文件
- `在新窗口中导入...`：打开文件并放到新窗口中
- `保存`：保存到当前文件；未绑定文件时会弹出保存对话框
- `另存为...`：选择新路径保存
- `最近打开`：从持久化列表中打开最近文件

视图菜单：

- 选择浅色、深色或跟随系统主题
- 切换编辑器
- 进入或退出 Zen 模式
- 系统全屏

浏览器开发模式没有系统保存对话框，点击保存会下载 Markdown 文件。桌面端会真实写入本地文件。

## 网页预览版和更新检查

网页预览版位于 `docs/index.html`，由 `npm run build:pages` 生成。仓库开启 GitHub Pages 时，建议选择 `main` 分支的 `docs/` 目录作为 Pages 来源。

- 仓库地址：<https://github.com/unknownparticles/md.git>
- 网页预览版：<https://unknownparticles.github.io/md/>
- Release 页面：<https://github.com/unknownparticles/md/releases>
- 最新 Release API：<https://api.github.com/repos/unknownparticles/md/releases/latest>
- 静态更新清单：<https://unknownparticles.github.io/md/update.json>

网页预览版会直接打开 Markdown 阅读器界面，并在顶部提供 macOS Apple Silicon 版 App 的下载入口。应用内“设置 -> 更新 -> 检查更新”会优先使用 GitHub Release API。如果 GitHub API 匿名额度耗尽或暂时不可用，会回退到 GitHub Pages 上的静态更新清单 `docs/update.json`。如果仓库没有 Release，且静态清单也不可用，检查结果会显示失败。

桌面端检测到新版本时，会按当前系统优先选择安装包：

- macOS：优先 `.dmg`，其次 `.zip`
- Windows：优先 `.exe`，其次 `.msi`、`.zip`
- Linux：优先 `.AppImage`，其次 `.deb`

点击“下载并打开安装包”后，应用会把 Release 产物下载到本机应用数据目录的 `updates/` 子目录，并调用系统默认安装器打开。覆盖安装仍由系统安装器完成，这样可以保留 macOS、Windows 和 Linux 各自的签名、权限和安装流程。

手动上传 Release 产物后，请同步更新 `docs/update.json` 中的 `tag_name`、`html_url`、`assets[].name`、`assets[].browser_download_url` 和 `assets[].size`。这个文件用于 GitHub API 403 限流时的兜底更新检查。

## Release 上传

先完成对应平台打包，再发布 Release：

```bash
npm run package:mac
GITHUB_TOKEN=你的令牌 npm run release:publish
```

`release:publish` 会读取 `package.json` 的版本号，例如 `1.0.0` 会使用 `v1.0.0` tag。脚本会检查 GitHub Release 是否存在；不存在就创建 Release，并上传 `release/` 目录中的关键产物，包括 `.dmg`、`.zip`、`.exe`、`.AppImage` 和 `.deb`。

如果缺少 `GITHUB_TOKEN` 或 `GH_TOKEN`，脚本会失败，不会假装发布成功。

## 打包

macOS 双击打包：

```bash
./一键打包.command
```

命令行一键打包：

```bash
npm run package:mac
npm run package:win
npm run package:linux
npm run package:all
```

直接调用 electron-builder：

```bash
npm run build:mac
npm run build:win
npm run build:linux
npm run build:desktop
```

打包产物输出到 `release/`。文件名会包含真实版本号，例如 `alun reader-1.0.0-arm64.dmg`。

## 开发约定

- 不提交 `node_modules/`、`dist/`、`release/` 等构建产物
- 修改渲染逻辑后至少运行 `npm run lint` 和 `npm run build`
- Electron 文件访问只放在主进程，前端通过 preload 暴露的受控 API 调用

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](./LICENSE.md)。

你可以在非商业场景中查看、学习、修改和分发本项目。所有源码公开、开源或源码可见的非商业项目，都可以使用、修改、集成和分发本项目及其派生作品。

未经额外书面授权，不得将本项目或其派生作品用于商业用途，包括但不限于售卖、商业 SaaS、商业内部工具、商业客户交付或其他以商业收益为目的的使用。
