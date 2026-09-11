#!/usr/bin/env bash

set -euo pipefail

APP_NAME="dy-live-server"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="$(id -un)"
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"

echo
echo "========================================"
echo " DYYY Live Photo Server Installer"
echo "========================================"
echo
echo "用户: $APP_USER"
echo "目录: $APP_DIR"
echo "HOME: $APP_HOME"
echo


# ------------------------------------------------------------
# 1. 基础工具
# ------------------------------------------------------------

echo "[1/8] 检查基础工具..."

if ! command -v node >/dev/null 2>&1 || \
   ! command -v npm >/dev/null 2>&1; then

    echo "未检测到 Node.js/npm，正在安装..."

    sudo apt-get update

    sudo apt-get install -y \
        nodejs \
        npm \
        git \
        curl \
        ca-certificates
fi


NODE_BIN="$(command -v node)"
NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"

echo "Node: $NODE_VERSION"
echo "Node路径: $NODE_BIN"
echo "npm: $NPM_VERSION"


# ------------------------------------------------------------
# 2. Node版本检查
# ------------------------------------------------------------

echo
echo "[2/8] 检查 Node.js 版本..."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo
    echo "错误：需要 Node.js 18 或更高版本。"
    echo "当前版本：$NODE_VERSION"
    exit 1
fi


# ------------------------------------------------------------
# 3. Node依赖
# ------------------------------------------------------------

echo
echo "[3/8] 安装 Node.js 项目依赖..."

cd "$APP_DIR"

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi


# ------------------------------------------------------------
# 4. Playwright Linux依赖
# ------------------------------------------------------------

echo
echo "[4/8] 安装 Chromium 系统依赖..."

PLAYWRIGHT_BIN="$APP_DIR/node_modules/.bin/playwright"

if [ ! -x "$PLAYWRIGHT_BIN" ]; then
    echo "错误：未找到 Playwright。"
    echo "请确认 package.json 中包含 playwright。"
    exit 1
fi

sudo "$PLAYWRIGHT_BIN" install-deps chromium


# ------------------------------------------------------------
# 5. Chromium
# ------------------------------------------------------------

echo
echo "[5/8] 安装 Playwright Chromium..."

"$PLAYWRIGHT_BIN" install chromium


# ------------------------------------------------------------
# 6. systemd
# ------------------------------------------------------------

echo
echo "[6/8] 创建 systemd 服务..."

SERVICE_TEMPLATE="$APP_DIR/deploy/dy-live-server.service.template"
SERVICE_FILE="/etc/systemd/system/dy-live-server.service"

if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo "错误：找不到 systemd 模板："
    echo "$SERVICE_TEMPLATE"
    exit 1
fi

sudo systemctl stop dy-live-server 2>/dev/null || true

sed \
    -e "s|__USER__|$APP_USER|g" \
    -e "s|__HOME__|$APP_HOME|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__NODE_BIN__|$NODE_BIN|g" \
    "$SERVICE_TEMPLATE" \
    | sudo tee "$SERVICE_FILE" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now dy-live-server


# ------------------------------------------------------------
# 7. Tailscale Serve
# ------------------------------------------------------------

echo
echo "[7/8] 检查 Tailscale..."

if command -v tailscale >/dev/null 2>&1; then

    echo "检测到 Tailscale。"

    if tailscale status >/dev/null 2>&1; then
        echo "恢复 Tailscale Serve → 127.0.0.1:8899"

        sudo tailscale serve --bg 8899 || true
    else
        echo
        echo "Tailscale 尚未登录。"
        echo "请执行："
        echo
        echo "sudo tailscale up"
        echo
        echo "完成登录后再执行："
        echo
        echo "sudo tailscale serve --bg 8899"
    fi

else
    echo
    echo "当前系统没有安装 Tailscale。"
    echo "程序本身已经安装完成。"
fi


# ------------------------------------------------------------
# 8. 检查
# ------------------------------------------------------------

echo
echo "[8/8] 健康检查..."

sleep 2

echo
echo "systemd 状态："
systemctl is-enabled dy-live-server || true
systemctl is-active dy-live-server || true

echo
echo "本机健康检查："

curl -s \
    http://127.0.0.1:8899/health \
    || true

echo
echo
echo "========================================"
echo " 安装完成"
echo "========================================"
echo
echo "查看服务："
echo "systemctl status dy-live-server"
echo
echo "查看日志："
echo "journalctl -u dy-live-server -f"
echo
echo "查看 Tailscale Serve："
echo "tailscale serve status"
echo
