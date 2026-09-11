# DYYY Live Photo Server

用于 DYYY 的抖音媒体解析服务。

目前主要解决原普通 HTTP API 无法稳定解析抖音 Live Photo /
实况图集的问题。

## 已验证功能

- 普通视频
- 普通图文
- 纯 Live Photo / 实况图集
- 实况 + 普通图片混合图集
- Playwright Chromium 浏览器解析
- 抖音图片代理
- 实况 MP4 代理
- JPEG 转换
- DYYY API JSON 输出
- Tailscale HTTPS
- systemd 开机自启
- Ubuntu 重启后自动恢复

## 核心文件

~~~text
server.mjs
package.json
package-lock.json
install.sh
restore.sh
update.sh

deploy/
docs/
scripts/
~~~

## 当前监听地址

~~~text
http://127.0.0.1:8899
~~~

## 健康检查

~~~bash
curl http://127.0.0.1:8899/health
~~~

正常：

~~~json
{"ok":true,"service":"dy-live-server"}
~~~

## 当前 DYYY 接口

~~~text
https://ts.tailc27773.ts.net/api/dyyy?url=
~~~

## 快速安装

克隆仓库：

~~~bash
git clone <YOUR_GITHUB_REPO>
cd dy-live-server
~~~

执行：

~~~bash
bash install.sh
~~~

## 一键恢复

~~~bash
bash restore.sh
~~~

## Chromium 单独安装

安装 Chromium Linux 系统依赖：

~~~bash
sudo ./node_modules/.bin/playwright install-deps chromium
~~~

安装 Chromium：

~~~bash
./node_modules/.bin/playwright install chromium
~~~

如果已经安装 npm 依赖，也可以：

~~~bash
sudo npx playwright install-deps chromium
npx playwright install chromium
~~~

## 服务管理

~~~bash
systemctl status dy-live-server
sudo systemctl restart dy-live-server
journalctl -u dy-live-server -f
~~~

详细命令：

~~~text
docs/COMMANDS.md
~~~

完整恢复：

~~~text
docs/RESTORE.md
~~~

Surge：

~~~text
docs/SURGE.md
~~~

架构：

~~~text
docs/ARCHITECTURE.md
~~~

Cloudflare：

~~~text
docs/CLOUDFLARE.md
~~~

## 注意

不要上传以下内容：

- node_modules
- Chromium浏览器缓存
- Tailscale身份文件
- Tailscale Auth Key
- Cookie
- Token
- API Key
- .env
- 日志

Tailscale 身份状态位于系统目录，不应提交到 GitHub。

## 详细完整说明

[查看非常详细的说明](docs/非常详细的说明.md)
