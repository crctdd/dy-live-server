#!/usr/bin/env bash

echo
echo "========================================"
echo " dy-live-server Health Check"
echo "========================================"
echo

echo "[systemd enabled]"
systemctl is-enabled dy-live-server || true

echo
echo "[systemd active]"
systemctl is-active dy-live-server || true

echo
echo "[local health]"
curl -s http://127.0.0.1:8899/health || true

echo
echo
echo "[Tailscale Serve]"
tailscale serve status 2>/dev/null || true

echo

if [ -n "${1:-}" ]; then
    echo "[remote health]"
    curl --noproxy '*' -s "$1/health" || true
    echo
fi
