/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownPreview } from './components/MarkdownPreview';
import { Download, ExternalLink, LayoutDashboard, PanelLeftClose, PanelRightClose, Settings2, FilePlus2, FileUp, RefreshCcw, Save, Sun, Moon, Monitor, X, Presentation, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import appIcon from '../assets/icon.png';
import { GITHUB_LATEST_RELEASE_API, GITHUB_RELEASES_URL, UPDATE_MANIFEST_URL } from './release';

export type ThemeMode = 'light' | 'dark' | 'system';

type UpdateStatus = {
  state: 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'downloaded' | 'failed';
  message: string;
  url?: string;
  latestVersion?: string;
  asset?: UpdateReleaseAsset;
};

type RuntimePlatform = 'mac' | 'windows' | 'linux' | 'unknown';

type UpdateReleaseAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: UpdateReleaseAsset[];
};

type UpdateSource = 'GitHub Release API' | '静态更新清单';

const DEFAULT_MARKDOWN = `# 欢迎使用 alun reader

体验高精度 Markdown 渲染，支持 **语法高亮** 和 **Mermaid 流程图**。

## 📊 Mermaid 图表示例
在您的文档中即时可视化逻辑。支持放大缩小和全屏查看。

\`\`\`mermaid
graph TD
    A[开始] --> B{是否正常?}
    B -- 是 --> C[庆祝!]
    B -- 否 --> D[检查日志]
    D --> B
    C --> E[结束]
\`\`\`

## 💻 多语言代码高亮
以任何语言编写代码，均可获得精美的高亮效果。

### TypeScript
\`\`\`typescript
const greeting: string = "Hello, AI Studio!";

interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
}

function welcome(user: User) {
  console.log(\`Welcome back, \${user.name}!\`);
}
\`\`\`

## 📝 标准 Markdown 演示
- **列表** 完美对齐
- [x] 支持 **任务列表**
- **表格** 支持 (见下文)

| 功能 | 支持状态 | 性能 |
| :--- | :---: | ---: |
| Markdown | ✅ | 极高 |
| Mermaid | ✅ | 流畅 |
| 代码高亮 | ✅ | 极速 |

> "预测未来的最好方法就是创造它。" - 彼得·德鲁克
`;

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: 'light',
    label: '浅色',
    description: '使用明亮背景，适合白天阅读。',
    icon: Sun,
  },
  {
    value: 'dark',
    label: '深色',
    description: '降低大面积亮度，适合夜间使用。',
    icon: Moon,
  },
  {
    value: 'system',
    label: '跟随系统',
    description: '自动跟随 macOS 或系统外观设置。',
    icon: Monitor,
  },
];

const CURRENT_VERSION = import.meta.env.PACKAGE_VERSION;

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '').split('-')[0];
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function getRuntimePlatform(): RuntimePlatform {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux';
  return 'unknown';
}

function getPlatformAssetPriority(platform: RuntimePlatform) {
  if (platform === 'mac') return ['.dmg', '.zip'];
  if (platform === 'windows') return ['.exe', '.msi', '.zip'];
  if (platform === 'linux') return ['.appimage', '.deb'];
  return ['.dmg', '.exe', '.appimage', '.deb', '.zip'];
}

function pickUpdateAsset(assets: UpdateReleaseAsset[] = []) {
  const priorities = getPlatformAssetPriority(getRuntimePlatform());
  const downloadableAssets = assets.filter((asset) => Boolean(asset.browser_download_url));

  for (const extension of priorities) {
    const matchedAsset = downloadableAssets.find((asset) => asset.name.toLowerCase().endsWith(extension));
    if (matchedAsset) return matchedAsset;
  }

  return null;
}

function formatFileSize(size?: number) {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function fetchLatestReleaseFromApi() {
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Release 返回 ${response.status}`);
  }

  return await response.json() as GitHubReleaseResponse;
}

async function fetchLatestReleaseFromManifest() {
  const response = await fetch(UPDATE_MANIFEST_URL, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`静态更新清单返回 ${response.status}`);
  }

  return await response.json() as GitHubReleaseResponse;
}

async function fetchLatestRelease() {
  try {
    return {
      release: await fetchLatestReleaseFromApi(),
      source: 'GitHub Release API' as UpdateSource,
    };
  } catch (apiError) {
    // GitHub API 匿名额度很低；静态清单由 GitHub Pages 承载，避免普通用户检查更新被限流阻断。
    return {
      release: await fetchLatestReleaseFromManifest(),
      source: '静态更新清单' as UpdateSource,
      fallbackReason: apiError instanceof Error ? apiError.message : 'GitHub Release API 不可用',
    };
  }
}

export default function App() {
  const [content, setContent] = useState(DEFAULT_MARKDOWN);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('未保存的新文档');
  const [showEditor, setShowEditor] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: 'idle',
    message: `当前版本 v${CURRENT_VERSION}，从 GitHub Release 检查最新安装包。`,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMarkdownDocument = useCallback((nextContent: string, filePath: string | null = null) => {
    setContent(nextContent);
    setCurrentFilePath(filePath);
    setIsDirty(false);
    setStatusMessage(filePath ? `已打开 ${filePath.split('/').pop()}` : '未保存的新文档');
  }, []);

  const createNewDocument = useCallback(async () => {
    if (window.alunReader) {
      await window.alunReader.newWindow();
      return;
    }

    loadMarkdownDocument('', null);
  }, [loadMarkdownDocument]);

  const openMarkdownDocument = useCallback(async () => {
    if (window.alunReader) {
      const result = await window.alunReader.openMarkdown();
      if (result) {
        loadMarkdownDocument(result.content, result.filePath);
      }
      return;
    }

    fileInputRef.current?.click();
  }, [loadMarkdownDocument]);

  const saveMarkdownDocument = useCallback(async (saveAs = false) => {
    if (!window.alunReader) {
      const blob = new Blob([content], {type: 'text/markdown;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentFilePath?.split('/').pop() || '未命名.md';
      link.click();
      URL.revokeObjectURL(url);
      setIsDirty(false);
      setStatusMessage('已下载 Markdown 文件');
      return;
    }

    const result = await window.alunReader.saveMarkdown({
      filePath: saveAs ? null : currentFilePath,
      content,
    });

    if (result) {
      setCurrentFilePath(result.filePath);
      setIsDirty(false);
      setStatusMessage(`已保存 ${result.filePath.split('/').pop()}`);
    } else {
      setStatusMessage('已取消保存');
    }
  }, [content, currentFilePath]);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus({
      state: 'checking',
      message: '正在检查更新...',
    });

    try {
      const {release, source, fallbackReason} = await fetchLatestRelease();
      const latestVersion = release.tag_name ?? release.name ?? '';
      const releaseUrl = release.html_url ?? GITHUB_RELEASES_URL;
      const sourceHint = source === '静态更新清单' && fallbackReason ? `（GitHub API 不可用：${fallbackReason}，已改用静态清单）` : '';

      if (!latestVersion) {
        setUpdateStatus({
          state: 'failed',
          message: `检查失败：${source} 没有可识别的版本号。`,
          url: releaseUrl,
        });
        return;
      }

      if (compareVersions(latestVersion, CURRENT_VERSION) <= 0) {
        setUpdateStatus({
          state: 'latest',
          message: `已是最新版本：当前 v${CURRENT_VERSION}，最新 ${latestVersion}。${sourceHint}`,
          latestVersion,
          url: releaseUrl,
        });
        return;
      }

      const asset = pickUpdateAsset(release.assets);
      if (!asset) {
        setUpdateStatus({
          state: 'failed',
          message: `发现新版本 ${latestVersion}，但没有匹配当前平台的安装包。${sourceHint}`,
          latestVersion,
          url: releaseUrl,
        });
        return;
      }

      setUpdateStatus({
        state: 'available',
        message: `发现新版本 ${latestVersion}，可下载 ${asset.name}${formatFileSize(asset.size) ? `（${formatFileSize(asset.size)}）` : ''}。${sourceHint}`,
        latestVersion,
        asset,
        url: releaseUrl,
      });
    } catch (error) {
      setUpdateStatus({
        state: 'failed',
        message: error instanceof Error ? `检查失败：${error.message}。` : '检查失败：无法访问更新来源。',
        url: GITHUB_RELEASES_URL,
      });
    }
  }, []);

  const downloadLatestUpdate = useCallback(async () => {
    if (!updateStatus.asset) return;

    const asset = updateStatus.asset;
    setUpdateStatus((status) => ({
      ...status,
      state: 'downloading',
      message: `正在下载 ${asset.name}...`,
    }));

    if (!window.alunReader) {
      window.open(asset.browser_download_url, '_blank', 'noopener,noreferrer');
      setUpdateStatus((status) => ({
        ...status,
        state: 'downloaded',
        message: '已打开浏览器下载链接。桌面端会直接下载并打开安装包。',
      }));
      return;
    }

    try {
      const result = await window.alunReader.downloadUpdate(asset);
      setUpdateStatus((status) => ({
        ...status,
        state: result.opened ? 'downloaded' : 'failed',
        message: result.opened
          ? `已下载并打开安装包：${asset.name}。请按系统安装器提示完成更新。`
          : `已下载到 ${result.filePath}，但系统未能自动打开：${result.openError ?? '未知错误'}。`,
      }));
    } catch (error) {
      setUpdateStatus((status) => ({
        ...status,
        state: 'failed',
        message: error instanceof Error ? `下载失败：${error.message}` : '下载失败：未知错误。',
      }));
    }
  }, [updateStatus.asset]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateSystemTheme = () => {
      setSystemPrefersDark(mediaQuery.matches);
    };

    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  useEffect(() => {
    if (!window.alunReader) return;

    // Electron 菜单通过 preload 发送命令，避免前端直接接触 Node 文件系统。
    return window.alunReader.onMenuCommand(async ({command, payload}) => {
      if (command === 'new') {
        await createNewDocument();
        return;
      }

      if (command === 'open') {
        await openMarkdownDocument();
        return;
      }

      if (command === 'load-document' && typeof payload?.content === 'string') {
        loadMarkdownDocument(payload.content, payload.filePath ?? null);
        return;
      }

      if (command === 'open-recent' && payload?.filePath) {
        const result = await window.alunReader?.openRecent(payload.filePath);
        if (result) {
          loadMarkdownDocument(result.content, result.filePath);
        }
        return;
      }

      if (command === 'save') {
        await saveMarkdownDocument(false);
        return;
      }

      if (command === 'save-as') {
        await saveMarkdownDocument(true);
        return;
      }

      if (command === 'set-theme' && payload?.theme) {
        setThemeMode(payload.theme);
        return;
      }

      if (command === 'toggle-editor') {
        setShowEditor((value) => !value);
        return;
      }

      if (command === 'toggle-zen') {
        setIsZenMode((value) => !value);
      }
    });
  }, [createNewDocument, loadMarkdownDocument, openMarkdownDocument, saveMarkdownDocument]);

  const isDarkTheme = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
  const accentTextClass = isDarkTheme ? 'text-sky-300' : 'text-slate-700';
  const accentSoftClass = isDarkTheme ? 'bg-slate-800 text-sky-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        loadMarkdownDocument(text, file.name);
      }
    };
    reader.readAsText(file);
    // 允许用户连续选择同一个文件，否则浏览器不会触发 change 事件。
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors ${isDarkTheme ? 'bg-[#11161c] text-slate-100' : 'bg-[#f6f7f8] text-neutral-900'}`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".md,.markdown,.txt" 
        className="hidden" 
      />
      {/* Zen 模式用于投屏讲解，只保留阅读内容和退出按钮。 */}
      {!isZenMode && (
      <aside className={`w-16 flex-none border-r flex flex-col items-center py-6 gap-8 shadow-sm z-20 transition-colors ${isDarkTheme ? 'bg-[#151b22] border-slate-700/70' : 'bg-white border-slate-200'}`}>
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center overflow-hidden transition-colors ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <img src={appIcon} alt="alun reader" className="h-8 w-8 object-contain" />
        </div>
        <nav className="flex flex-col gap-4">
          <button className={`p-2.5 rounded-lg border ${accentSoftClass}`} title="阅读视图"><LayoutDashboard size={22} /></button>
          <button
            onClick={createNewDocument}
            className={`p-2.5 rounded-lg transition-colors ${isDarkTheme ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            title="新建窗口"
          >
            <FilePlus2 size={22} />
          </button>
        </nav>
        <div className="mt-auto pb-2 flex flex-col gap-6">
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2.5 rounded-lg transition-colors ${showSettings ? accentSoftClass : isDarkTheme ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            title="设置"
          >
            <Settings2 size={22} />
          </button>
        </div>
      </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!isZenMode && (
        <header className={`h-16 border-b flex items-center justify-between px-8 z-10 shrink-0 transition-colors ${isDarkTheme ? 'bg-[#151b22] border-slate-700/70' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <h1 className={`font-display font-semibold text-xl tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>alun reader</h1>
            <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${accentSoftClass}`}>v{CURRENT_VERSION}</span>
            <span className={`max-w-[320px] truncate text-xs ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
              {isDirty ? '未保存 - ' : ''}{statusMessage}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={createNewDocument}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${isDarkTheme ? 'text-slate-200 hover:bg-slate-800 border-slate-700' : 'text-slate-700 hover:bg-slate-100 border-slate-200'}`}
            >
              <FilePlus2 size={16} />
              新建
            </button>
            <button 
              onClick={openMarkdownDocument}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${isDarkTheme ? 'text-slate-200 hover:bg-slate-800 border-slate-700' : 'text-slate-700 hover:bg-slate-100 border-slate-200'}`}
            >
              <FileUp size={16} />
              打开文件
            </button>
            <button 
              onClick={() => setShowEditor(!showEditor)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${isDarkTheme ? 'text-slate-200 hover:bg-slate-800 border-slate-700' : 'text-slate-700 hover:bg-slate-100 border-slate-200'}`}
            >
              {showEditor ? <PanelLeftClose size={16} /> : <PanelRightClose size={16} />}
              {showEditor ? '隐藏编辑器' : '显示编辑器'}
            </button>
            <button
              onClick={() => setIsZenMode(true)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${isDarkTheme ? 'text-sky-200 hover:bg-slate-800 border-slate-700' : 'text-slate-700 hover:bg-slate-100 border-slate-300'}`}
            >
              <Presentation size={16} />
              Zen 模式
            </button>
            <button
              onClick={() => saveMarkdownDocument(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors border ${isDarkTheme ? 'bg-slate-200 text-slate-950 hover:bg-white border-slate-200' : 'bg-slate-900 text-white hover:bg-slate-700 border-slate-900'}`}
            >
              <span className="flex items-center gap-2">
                <Save size={16} />
                保存更改
              </span>
            </button>
          </div>
        </header>
        )}

        {/* 主内容区采用左右分栏，用户可隐藏编辑器只保留阅读视图。 */}
        <main className="flex-1 flex overflow-hidden">
          {showEditor && !isZenMode && (
              <div
                className={`w-[40%] border-r flex flex-col shrink-0 transition-colors ${isDarkTheme ? 'bg-[#151b22] border-slate-700/70' : 'bg-white border-slate-200'}`}
              >
                <div className={`p-4 border-b flex items-center justify-between transition-colors ${isDarkTheme ? 'bg-[#151b22] border-slate-700/70' : 'bg-white border-slate-100'}`}>
                  <span className="text-xs font-bold text-slate-400 tracking-widest flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDarkTheme ? 'bg-sky-300' : 'bg-slate-500'}`} />
                    Markdown 输入
                  </span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setIsDirty(true);
                    setStatusMessage(currentFilePath ? currentFilePath.split('/').pop() || currentFilePath : '未保存的新文档');
                  }}
                  className={`flex-1 p-6 font-mono text-sm resize-none focus:outline-none transition-colors ${isDarkTheme ? 'text-slate-100 bg-slate-950 placeholder:text-slate-500' : 'text-slate-700 bg-[#fdfdfd] placeholder:text-slate-400'}`}
                  spellCheck={false}
                  placeholder="在这里输入 Markdown 内容..."
                />
              </div>
          )}

          <section className={`flex-1 overflow-y-auto scroll-smooth transition-colors ${isZenMode ? 'px-10 md:px-16 lg:px-24' : 'px-8 md:px-12 lg:px-16'} ${isDarkTheme ? 'bg-[#11161c]' : 'bg-[#f6f7f8]'}`}>
            <div className={`${isZenMode ? 'max-w-6xl py-14 md:py-20' : 'max-w-5xl py-12'} mx-auto`}>
              <MarkdownPreview content={content} isDarkTheme={isDarkTheme} />
            </div>
          </section>
        </main>
      </div>

      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          className={`fixed right-5 top-5 z-50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${isDarkTheme ? 'bg-[#151b22]/95 text-slate-100 border-slate-700 hover:bg-slate-800' : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
        >
          <Minimize2 size={16} />
          退出 Zen
        </button>
      )}

      <AnimatePresence>
        {showSettings && (
          <>
            <motion.button
              type="button"
              aria-label="关闭设置遮罩"
              className="fixed inset-0 z-30 bg-slate-950/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
            />
            <motion.aside
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className={`fixed right-0 top-0 bottom-0 z-40 w-[360px] border-l shadow-2xl transition-colors ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div className={`h-16 px-5 border-b flex items-center justify-between ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  <h2 className={`text-base font-semibold ${isDarkTheme ? 'text-slate-100' : 'text-slate-900'}`}>设置</h2>
                  <p className={`text-xs mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>调整阅读器外观</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                  title="关闭设置"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <section>
                  <h3 className={`text-sm font-semibold mb-3 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>主题</h3>
                  <div className="space-y-2">
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = themeMode === option.value;

                      return (
                        <button
                          key={option.value}
                          onClick={() => setThemeMode(option.value)}
                          className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                            isSelected
                              ? accentSoftClass
                              : isDarkTheme
                                ? 'border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <Icon size={18} className={isSelected ? `${accentTextClass} mt-0.5` : 'text-slate-400 mt-0.5'} />
                          <span>
                            <span className="block text-sm font-medium">{option.label}</span>
                            <span className={`block text-xs mt-1 ${isSelected ? accentTextClass : isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <h3 className={`text-sm font-semibold mb-3 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>更新</h3>
                  <div className={`rounded-lg border p-3 ${isDarkTheme ? 'border-slate-800 bg-slate-950 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <p className={`text-sm ${updateStatus.state === 'failed' ? isDarkTheme ? 'text-red-200' : 'text-red-700' : isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                      {updateStatus.message}
                    </p>
                    <p className={`mt-2 text-xs ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>
                      当前版本：v{CURRENT_VERSION}{updateStatus.latestVersion ? ` · 最新版本：${updateStatus.latestVersion}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={checkForUpdates}
                        disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isDarkTheme ? 'border-slate-700 text-slate-100 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                      >
                        <RefreshCcw size={15} />
                        检查更新
                      </button>
                      {updateStatus.asset && (
                        <button
                          onClick={downloadLatestUpdate}
                          disabled={updateStatus.state === 'downloading'}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isDarkTheme ? 'bg-slate-200 text-slate-950 border-slate-200 hover:bg-white' : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-700'}`}
                        >
                          <Download size={15} />
                          {window.alunReader ? '下载并打开安装包' : '打开下载链接'}
                        </button>
                      )}
                      <a
                        href={updateStatus.url ?? GITHUB_RELEASES_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 text-sm ${isDarkTheme ? 'text-sky-300 hover:text-sky-200' : 'text-slate-700 hover:text-slate-950'}`}
                      >
                        Release 页面
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
