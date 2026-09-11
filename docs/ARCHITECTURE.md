# 架构说明

当前整体结构：

~~~text
iPhone
  |
  | DYYY
  |
  v
Surge
  |
  | iOS Tailnet
  |
  v
Tailscale
  |
  v
https://ts.tailc27773.ts.net
  |
  | Tailscale Serve
  |
  v
127.0.0.1:8899
  |
  v
dy-live-server
  |
  +---------------------------+
  |                           |
  | Live Photo                | 普通内容 / fallback
  v                           v
Playwright Chromium       Cloudflare DyExtract
  |                           |
  v                           v
Douyin Web               crctdd97.pages.dev
~~~

## Live Photo流程

~~~text
DYYY分享URL
  ↓
/api/dyyy?url=
  ↓
解析短链接
  ↓
打开Douyin Note页面
  ↓
Playwright Chromium
  ↓
提取 aweme-images
  ↓
提取 douyinvod MP4
  ↓
图片和实况视频配对
  ↓
生成：
images[]
live_videos[]
video_list[]
  ↓
媒体通过 /media/image 与 /media/live 代理
  ↓
DYYY
  ↓
iOS Photos Live Photo
~~~
