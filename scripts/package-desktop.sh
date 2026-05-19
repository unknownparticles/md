#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-mac}"

cd "$ROOT_DIR"

print_step() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail() {
  printf '\n打包失败：%s\n' "$1" >&2
  exit 1
}

case "$TARGET" in
  mac|win|linux|all) ;;
  *)
    fail "未知目标 '${TARGET}'。可用目标：mac、win、linux、all。"
    ;;
esac

command -v node >/dev/null 2>&1 || fail "未找到 node，请先安装 Node.js。"
command -v npm >/dev/null 2>&1 || fail "未找到 npm，请先安装 Node.js。"

print_step "当前项目：$ROOT_DIR"
print_step "打包目标：$TARGET"
print_step "检查依赖"

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  # 初次打包时自动安装依赖，避免双击脚本后只看到缺依赖错误。
  npm install
fi

print_step "运行 TypeScript 检查"
npm run lint

print_step "开始打包"
case "$TARGET" in
  mac)
    npm run build:mac
    ;;
  win)
    npm run build:win
    ;;
  linux)
    npm run build:linux
    ;;
  all)
    npm run build:desktop
    ;;
esac

print_step "打包产物"
find "$ROOT_DIR/release" -maxdepth 2 \( -name "*.app" -o -name "*.dmg" -o -name "*.zip" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.exe" \) -print | sort

printf '\n一键打包完成。\n'
