#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR"

echo
echo "========================================"
echo " DYYY Live Server Restore"
echo "========================================"
echo

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "检查 GitHub 更新..."

    git pull --ff-only || true
fi

echo
echo "开始恢复依赖、Chromium、systemd..."
echo

bash "$APP_DIR/install.sh"
