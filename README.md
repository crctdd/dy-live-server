本项目主要以本地部署方式使用。本人目前通过 Surge 内置的 Tailscale 协议加入 Tailnet，使 iOS 设备与 Ubuntu 主机处于同一私有网络中，并由 DYYY 直接请求本地部署的抖音解析服务。
这种方式无需直接将解析后端端口暴露到公网，适合个人自用、局域网环境以及多设备之间调用。后端服务可保持仅监听 127.0.0.1 或 Tailscale 网络地址，再根据实际需求通过 Tailscale Serve、Caddy、Nginx 或其他反向代理方式对外提供接口。
本项目不限制具体部署环境，你也可以将其部署到VPS、家庭服务器、NAS 或其他 Linux 主机中。网络入口、域名、端口及鉴权方式均可根据自己的环境调整。
内置有安装脚本，可直接一键部署。

# DYYY Live Photo Server
用于抖音媒体解析服务，搭配插件使用 如DYYY。
目前主要解决原普通 HTTP API 无法稳定解析抖音 Live Photo / 实况图集的问题。

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


## 致谢与代码来源

本项目的部分代码、实现思路及抖音解析逻辑参考并借鉴了开源项目 Hartcher1996/DyExtract：
https://github.com/Hartcher1996/DyExtract

感谢原作者 Hartcher1996 的开源。

本人在原项目基础上，根据个人使用场景进行了适配、修改与功能扩展，包括本地化部署、DYYY接口适配，以及针对图集、实况照片（Live Photo）等场景的相关处理。

本项目并非完全从零开发，原项目相关代码的著作权及贡献归原作者所有。对于基于原项目代码修改或衍生的部分，请遵循原项目所采用的MIT License。

## 免责声明

本项目仅供个人学习、技术研究及交流使用，请勿用于违反相关法律法规、平台服务条款或侵犯他人合法权益的用途。

使用本项目所产生的任何后果由使用者自行承担。请尊重内容创作者的著作权及其他合法权益。
