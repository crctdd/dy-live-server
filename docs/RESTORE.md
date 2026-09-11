# Ubuntu 重装 / 新机器完整恢复

## 1. 安装 Git

~~~bash
sudo apt update
sudo apt install -y git curl ca-certificates
~~~

## 2. 克隆 GitHub

~~~bash
git clone <YOUR_GITHUB_REPO>
cd dy-live-server
~~~

## 3. 一键恢复

~~~bash
bash restore.sh
~~~

该脚本会恢复：

- npm依赖
- Playwright
- Chromium系统依赖
- Chromium浏览器
- systemd
- 开机自启
- Tailscale Serve（如果Tailscale已经登录）

## 4. 如果 Tailscale 尚未安装

~~~bash
curl -fsSL https://tailscale.com/install.sh | sh
~~~

然后：

~~~bash
sudo tailscale up
~~~

按照提示重新登录 tailnet。

## 5. Tailscale Serve

~~~bash
sudo tailscale serve --bg 8899
~~~

查看：

~~~bash
tailscale serve status
~~~

## 6. 测试

~~~bash
systemctl is-enabled dy-live-server
systemctl is-active dy-live-server
~~~

~~~bash
curl -s http://127.0.0.1:8899/health
~~~

查看当前 MagicDNS：

~~~bash
tailscale status --json |
python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))'
~~~

然后：

~~~bash
curl --noproxy '*' -s \
https://你的MagicDNS域名/health
~~~

## 7. DYYY

接口格式：

~~~text
https://你的MagicDNS域名/api/dyyy?url=
~~~

当前服务器：

~~~text
https://ts.tailc27773.ts.net/api/dyyy?url=
~~~

## 重要

以下文件绝对不要上传 GitHub：

~~~text
/var/lib/tailscale/
tailscaled.state
Auth Key
Cookie
Token
.env
~~~

Tailscale 的身份认证需要在新系统上重新登录。

如果重新登录后 MagicDNS 主机名发生变化，
需要同步修改：

- DYYY接口
- Surge规则
- 健康检查地址
