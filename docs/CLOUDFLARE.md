# Cloudflare DyExtract

当前 dy-live-server 并不是完全独立于 Cloudflare。

普通视频和普通图文仍可回退到原 DyExtract API。

当前接口：

~~~text
https://crctdd97.pages.dev/api/dyyy?url=
~~~

Cloudflare Pages Project：

~~~text
crctdd97
~~~

DyExtract GitHub：

~~~text
crctdd/DyExtract
~~~

本地目录：

~~~text
/home/ts/DyExtract
~~~

部署：

~~~bash
cd ~/DyExtract

npx wrangler@latest pages deploy public \
  --project-name crctdd97 \
  --branch main
~~~

因此完整系统建议保留两个 GitHub 仓库：

~~~text
crctdd/DyExtract
crctdd/dy-live-server
~~~
