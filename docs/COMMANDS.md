# 日常维护命令

## 服务

查看状态：

~~~bash
systemctl status dy-live-server
~~~

查看是否开机自启：

~~~bash
systemctl is-enabled dy-live-server
~~~

查看是否运行：

~~~bash
systemctl is-active dy-live-server
~~~

启动：

~~~bash
sudo systemctl start dy-live-server
~~~

停止：

~~~bash
sudo systemctl stop dy-live-server
~~~

重启：

~~~bash
sudo systemctl restart dy-live-server
~~~

设置开机自启：

~~~bash
sudo systemctl enable dy-live-server
~~~

取消开机自启：

~~~bash
sudo systemctl disable dy-live-server
~~~

重新读取 systemd：

~~~bash
sudo systemctl daemon-reload
~~~

## 日志

实时：

~~~bash
journalctl -u dy-live-server -f
~~~

最近100行：

~~~bash
journalctl -u dy-live-server -n 100 --no-pager
~~~

今天：

~~~bash
journalctl -u dy-live-server --since today
~~~

错误：

~~~bash
journalctl -u dy-live-server -p err --no-pager
~~~

## 8899

~~~bash
ss -ltnp | grep ':8899'
~~~

~~~bash
sudo fuser -v 8899/tcp
~~~

## 健康检查

本机：

~~~bash
curl -s http://127.0.0.1:8899/health
~~~

Tailscale：

~~~bash
curl --noproxy '*' -s \
https://ts.tailc27773.ts.net/health
~~~

## Tailscale

~~~bash
tailscale status
~~~

~~~bash
tailscale serve status
~~~

~~~bash
tailscale ip -4
~~~

启动 Serve：

~~~bash
sudo tailscale serve --bg 8899
~~~

关闭：

~~~bash
sudo tailscale serve --https=443 off
~~~

## Playwright

版本：

~~~bash
npx playwright --version
~~~

安装 Chromium：

~~~bash
npx playwright install chromium
~~~

安装 Chromium 系统依赖：

~~~bash
sudo npx playwright install-deps chromium
~~~

完整重新安装：

~~~bash
sudo npx playwright install-deps chromium
npx playwright install chromium
~~~

## Node

~~~bash
node -v
npm -v
command -v node
~~~

## 项目

进入：

~~~bash
cd ~/dy-live-server
~~~

检查语法：

~~~bash
node --check server.mjs
~~~

修改源码后：

~~~bash
sudo systemctl restart dy-live-server
~~~

## 完整健康检查

~~~bash
./scripts/health-check.sh \
https://ts.tailc27773.ts.net
~~~
