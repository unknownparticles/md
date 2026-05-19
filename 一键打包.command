#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

./scripts/package-desktop.sh mac

printf '\n按任意键关闭窗口...'
read -r -n 1 _
