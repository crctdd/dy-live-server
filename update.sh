#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR"

echo "拉取 GitHub 最新代码..."
git pull --ff-only

echo "恢复 Node 依赖..."

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

echo "检查 Chromium..."
"$APP_DIR/node_modules/.bin/playwright" install chromium

echo "重启 dy-live-server..."
sudo systemctl restart dy-live-server

echo
systemctl status dy-live-server --no-pager -l
