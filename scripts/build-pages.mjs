import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesAssetsDir = path.join(rootDir, 'docs', 'assets');

async function runViteBuild() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['exec', 'vite', 'build'], {
    cwd: rootDir,
    env: {
      ...process.env,
      BUILD_TARGET: 'pages',
    },
    stdio: 'inherit',
  });

  return await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`vite build 失败，退出码 ${code}`));
    });
  });
}

// GitHub Pages 的 update.json 需要保留，但 assets 是哈希产物，构建前清理可避免旧资源残留。
await fs.rm(pagesAssetsDir, {recursive: true, force: true});
await runViteBuild();
