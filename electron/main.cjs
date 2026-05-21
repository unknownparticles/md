const {app, BrowserWindow, Menu, dialog, ipcMain, shell} = require('electron');
const {createWriteStream} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');

const recentFilesStorePath = path.join(app.getPath('userData'), 'recent-files.json');
let recentFiles = [];
let pendingOpenFilePaths = [];

function sendMenuCommand(targetWindow, command, payload = {}) {
  const focusedWindow = targetWindow ?? BrowserWindow.getFocusedWindow();
  if (!focusedWindow) return;
  focusedWindow.webContents.send('menu-command', {command, payload});
}

async function loadRecentFiles() {
  try {
    const raw = await fs.readFile(recentFilesStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    recentFiles = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    recentFiles = [];
  }
}

async function persistRecentFiles() {
  await fs.mkdir(path.dirname(recentFilesStorePath), {recursive: true});
  await fs.writeFile(recentFilesStorePath, JSON.stringify(recentFiles, null, 2), 'utf8');
}

function rememberRecentFile(filePath) {
  if (!filePath) return;

  const existingIndex = recentFiles.indexOf(filePath);
  if (existingIndex >= 0) {
    recentFiles.splice(existingIndex, 1);
  }

  recentFiles.unshift(filePath);
  recentFiles.splice(8);
  app.addRecentDocument(filePath);
  persistRecentFiles().catch((error) => {
    console.error('Failed to persist recent files:', error);
  });
  buildApplicationMenu();
}

async function openMarkdownFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  rememberRecentFile(filePath);
  return {
    filePath,
    content,
  };
}

async function openMarkdownFiles(filePaths) {
  const uniqueFilePaths = [...new Set(filePaths.filter(Boolean))];
  return Promise.all(uniqueFilePaths.map((filePath) => openMarkdownFile(filePath)));
}

function getMainTargetWindow() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) return focusedWindow;

  const visibleWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
  return visibleWindow ?? createMainWindow();
}

function sendDocumentsToWindow(targetWindow, documents) {
  if (!documents.length) return;

  const command = documents.length === 1 ? 'load-document' : 'load-documents';
  const payload = documents.length === 1 ? documents[0] : {documents};
  const send = () => sendMenuCommand(targetWindow, command, payload);

  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once('did-finish-load', send);
    return;
  }

  send();
}

async function openMarkdownFilesInWindow(filePaths, targetWindow = getMainTargetWindow()) {
  const documents = await openMarkdownFiles(filePaths);
  sendDocumentsToWindow(targetWindow, documents);
  if (targetWindow.isMinimized()) targetWindow.restore();
  targetWindow.focus();
  return documents;
}

async function showOpenMarkdownDialog() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focusedWindow ?? undefined, {
    title: '导入 Markdown',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'txt']},
      {name: '所有文件', extensions: ['*']},
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return openMarkdownFiles(result.filePaths);
}

async function saveMarkdownFile(filePath, content) {
  let targetPath = filePath;

  if (!targetPath) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(focusedWindow ?? undefined, {
      title: '保存 Markdown',
      defaultPath: '未命名.md',
      filters: [
        {name: 'Markdown 文档', extensions: ['md']},
        {name: '文本文件', extensions: ['txt']},
      ],
    });

    if (result.canceled || !result.filePath) return null;
    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, content, 'utf8');
  rememberRecentFile(targetPath);
  return {filePath: targetPath};
}

async function reloadMarkdownFile(filePath) {
  if (!filePath) {
    throw new Error('当前文档还没有保存到本地文件，无法刷新。');
  }

  return openMarkdownFile(filePath);
}

function assertTrustedUpdateUrl(downloadUrl) {
  const parsedUrl = new URL(downloadUrl);
  const isGitHubReleaseAsset =
    parsedUrl.protocol === 'https:' &&
    parsedUrl.hostname === 'github.com' &&
    parsedUrl.pathname.startsWith('/unknownparticles/md/releases/download/');

  if (!isGitHubReleaseAsset) {
    throw new Error('更新包地址不是 alun reader 的 GitHub Release 产物。');
  }
}

async function downloadAndOpenUpdateAsset(asset) {
  if (!asset?.name || !asset?.browser_download_url) {
    throw new Error('缺少更新包名称或下载地址。');
  }

  assertTrustedUpdateUrl(asset.browser_download_url);

  if (typeof fetch !== 'function') {
    throw new Error('当前 Electron 运行环境不支持内置下载能力。');
  }

  const updatesDirectory = path.join(app.getPath('userData'), 'updates');
  const safeFileName = path.basename(asset.name);
  const targetPath = path.join(updatesDirectory, safeFileName);

  await fs.mkdir(updatesDirectory, {recursive: true});

  const response = await fetch(asset.browser_download_url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'alun-reader-updater',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`下载更新包失败：HTTP ${response.status}`);
  }

  // 主进程负责写入磁盘，保持 renderer 沙箱开启；下载完成后交给系统安装器处理。
  await pipeline(Readable.fromWeb(response.body), createWriteStream(targetPath));
  const openError = await shell.openPath(targetPath);

  return {
    filePath: targetPath,
    opened: openError.length === 0,
    openError: openError || undefined,
  };
}

function buildApplicationMenu() {
  const recentSubmenu = recentFiles.length > 0
    ? recentFiles.map((filePath) => ({
        label: path.basename(filePath),
        sublabel: filePath,
        click: () => openMarkdownFilesInWindow([filePath]).catch((error) => {
          dialog.showErrorBox('打开最近文件失败', error.message);
        }),
      }))
    : [{label: '暂无最近打开', enabled: false}];

  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: 'alun reader',
          submenu: [
            {role: 'about', label: '关于 alun reader'},
            {type: 'separator'},
            {role: 'services', label: '服务'},
            {type: 'separator'},
            {role: 'hide', label: '隐藏 alun reader'},
            {role: 'hideOthers', label: '隐藏其他'},
            {role: 'unhide', label: '显示全部'},
            {type: 'separator'},
            {role: 'quit', label: '退出 alun reader'},
          ],
        }]
      : []),
    {
      label: '文件',
      submenu: [
        {label: '新建窗口', accelerator: 'CmdOrCtrl+N', click: () => createMainWindow()},
        {label: '导入...', accelerator: 'CmdOrCtrl+O', click: async () => {
          const documents = await showOpenMarkdownDialog();
          if (!documents) return;
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            sendDocumentsToWindow(focusedWindow, documents);
          }
        }},
        {label: '在新窗口中导入...', accelerator: 'CmdOrCtrl+Shift+O', click: async () => {
          const documents = await showOpenMarkdownDialog();
          if (!documents) return;
          const window = createMainWindow();
          sendDocumentsToWindow(window, documents);
        }},
        {type: 'separator'},
        {label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand(null, 'save')},
        {label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuCommand(null, 'save-as')},
        {type: 'separator'},
        {label: '最近打开', submenu: recentSubmenu},
      ],
    },
    {
      label: '编辑',
      submenu: [
        {role: 'undo', label: '撤销'},
        {role: 'redo', label: '重做'},
        {type: 'separator'},
        {role: 'cut', label: '剪切'},
        {role: 'copy', label: '复制'},
        {role: 'paste', label: '粘贴'},
        {role: 'selectAll', label: '全选'},
      ],
    },
    {
      label: '视图',
      submenu: [
        {label: '浅色主题', click: () => sendMenuCommand(null, 'set-theme', {theme: 'light'})},
        {label: '深色主题', click: () => sendMenuCommand(null, 'set-theme', {theme: 'dark'})},
        {label: '跟随系统', click: () => sendMenuCommand(null, 'set-theme', {theme: 'system'})},
        {type: 'separator'},
        {label: '切换编辑器', accelerator: 'CmdOrCtrl+E', click: () => sendMenuCommand(null, 'toggle-editor')},
        {label: 'Zen 模式', accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendMenuCommand(null, 'toggle-zen')},
        {type: 'separator'},
        {role: 'reload', label: '重新载入'},
        {role: 'togglefullscreen', label: '系统全屏'},
      ],
    },
    {
      label: '窗口',
      submenu: [
        {role: 'minimize', label: '最小化'},
        {role: 'zoom', label: '缩放'},
        ...(process.platform === 'darwin'
          ? [
              {type: 'separator'},
              {role: 'front', label: '全部置于顶层'},
            ]
          : [
              {role: 'close', label: '关闭'},
            ]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Creates the main desktop window for alun reader.
 *
 * The renderer is the existing Vite build output. In development, set
 * ELECTRON_START_URL to load a local Vite server; packaged builds always load
 * the generated dist/index.html so the app does not depend on an external
 * browser or server.
 */
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'alun reader',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    mainWindow.loadURL(startUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    // Keep user-created external links out of the desktop shell window.
    shell.openExternal(url);
    return {action: 'deny'};
  });

  return mainWindow;
}

function getMarkdownFilePathsFromArgv(argv) {
  return argv
    .filter((arg) => /\.(md|markdown|mdown|txt)$/i.test(arg))
    .map((arg) => path.resolve(arg));
}

function queueOpenFilePaths(filePaths) {
  pendingOpenFilePaths.push(...filePaths);
}

async function flushPendingOpenFiles() {
  if (pendingOpenFilePaths.length === 0) return;

  const filePaths = pendingOpenFilePaths;
  pendingOpenFilePaths = [];

  try {
    await openMarkdownFilesInWindow(filePaths);
  } catch (error) {
    dialog.showErrorBox('打开 Markdown 文件失败', error.message);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePaths = getMarkdownFilePathsFromArgv(argv);
    if (filePaths.length > 0) {
      openMarkdownFilesInWindow(filePaths).catch((error) => {
        dialog.showErrorBox('打开 Markdown 文件失败', error.message);
      });
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();

    if (app.isReady()) {
      openMarkdownFilesInWindow([filePath]).catch((error) => {
        dialog.showErrorBox('打开 Markdown 文件失败', error.message);
      });
      return;
    }

    queueOpenFilePaths([filePath]);
  });

  queueOpenFilePaths(getMarkdownFilePathsFromArgv(process.argv.slice(1)));

  app.whenReady().then(async () => {
    await loadRecentFiles();
    buildApplicationMenu();
    createMainWindow();
    await flushPendingOpenFiles();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  ipcMain.handle('dialog:open-markdown', () => showOpenMarkdownDialog());
  ipcMain.handle('file:open-recent', (_event, filePath) => openMarkdownFile(filePath));
  ipcMain.handle('file:reload-markdown', (_event, filePath) => reloadMarkdownFile(filePath));
  ipcMain.handle('file:save-markdown', (_event, payload) => saveMarkdownFile(payload.filePath, payload.content));
  ipcMain.handle('window:new-document', () => {
    createMainWindow();
  });
  ipcMain.handle('update:download-open', (_event, asset) => downloadAndOpenUpdateAsset(asset));
}
