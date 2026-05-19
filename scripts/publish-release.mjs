import {createReadStream} from 'node:fs';
import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const owner = 'unknownparticles';
const repo = 'md';
const repoApiBase = `https://api.github.com/repos/${owner}/${repo}`;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const rootDir = process.cwd();
const releaseDir = path.join(rootDir, 'release');
const uploadExtensions = new Set(['.dmg', '.zip', '.exe', '.AppImage', '.deb']);

function fail(message) {
  console.error(`发布失败：${message}`);
  process.exit(1);
}

function getHeaders(extra = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alun-reader-release-script',
    ...extra,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });

  if (response.status === 204) return {response, data: null};

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return {response, data};
}

async function findReleaseAssetFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findReleaseAssetFiles(filePath));
      continue;
    }

    if (uploadExtensions.has(path.extname(entry.name))) {
      files.push(filePath);
    }
  }

  return files;
}

async function getPackageVersion() {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  if (!packageJson.version) {
    fail('package.json 缺少 version。');
  }
  return packageJson.version;
}

async function getCurrentSha() {
  const {response, data} = await request(`${repoApiBase}/git/ref/heads/main`);
  if (!response.ok) {
    fail(`无法读取 main 分支 SHA，GitHub 返回 ${response.status}。`);
  }
  return data.object.sha;
}

async function ensureTag(tagName) {
  const tagResult = await request(`${repoApiBase}/git/ref/tags/${tagName}`);
  if (tagResult.response.ok) return;

  if (tagResult.response.status !== 404) {
    fail(`检查 tag 失败，GitHub 返回 ${tagResult.response.status}。`);
  }

  const sha = await getCurrentSha();
  const createResult = await request(`${repoApiBase}/git/refs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: `refs/tags/${tagName}`,
      sha,
    }),
  });

  if (!createResult.response.ok) {
    fail(`创建 tag ${tagName} 失败，GitHub 返回 ${createResult.response.status}。`);
  }
}

async function getRelease(tagName) {
  const result = await request(`${repoApiBase}/releases/tags/${tagName}`);
  if (result.response.ok) return result.data;
  if (result.response.status === 404) return null;
  fail(`检查 Release 失败，GitHub 返回 ${result.response.status}。`);
}

async function createRelease(tagName, version) {
  const result = await request(`${repoApiBase}/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: tagName,
      name: `alun reader ${version}`,
      body: `alun reader ${version} release.\n\n如果自动更新检查无法找到 Release，请确认本页面存在并包含安装包产物。`,
      draft: false,
      prerelease: false,
    }),
  });

  if (!result.response.ok) {
    fail(`创建 Release 失败，GitHub 返回 ${result.response.status}。`);
  }

  return result.data;
}

async function deleteExistingAsset(release, assetName) {
  const asset = release.assets?.find((item) => item.name === assetName);
  if (!asset) return;

  const result = await request(`${repoApiBase}/releases/assets/${asset.id}`, {
    method: 'DELETE',
  });

  if (!result.response.ok && result.response.status !== 204) {
    fail(`删除旧产物 ${assetName} 失败，GitHub 返回 ${result.response.status}。`);
  }
}

async function uploadAsset(release, filePath) {
  const assetName = path.basename(filePath);
  await deleteExistingAsset(release, assetName);

  const fileInfo = await stat(filePath);
  const uploadUrl = release.upload_url.replace(/\{.*$/, '');
  const result = await fetch(`${uploadUrl}?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fileInfo.size),
    }),
    body: createReadStream(filePath),
    duplex: 'half',
  });

  if (!result.ok) {
    const message = await result.text();
    fail(`上传 ${assetName} 失败，GitHub 返回 ${result.status}：${message}`);
  }

  console.log(`已上传：${assetName}`);
}

async function main() {
  if (!token) {
    fail('缺少 GITHUB_TOKEN 或 GH_TOKEN，无法创建 Release 或上传产物。');
  }

  const version = await getPackageVersion();
  const tagName = `v${version}`;
  const assetFiles = await findReleaseAssetFiles(releaseDir);

  if (assetFiles.length === 0) {
    fail('release/ 中没有可上传的关键产物，请先运行 npm run package:mac、package:win 或 package:linux。');
  }

  await ensureTag(tagName);

  let release = await getRelease(tagName);
  if (!release) {
    release = await createRelease(tagName, version);
    console.log(`已创建 Release：${release.html_url}`);
  } else {
    console.log(`Release 已存在：${release.html_url}`);
  }

  for (const filePath of assetFiles) {
    await uploadAsset(release, filePath);
  }

  console.log(`发布完成：${release.html_url}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
