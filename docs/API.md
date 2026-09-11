# API

## 健康检查

~~~text
GET /health
~~~

示例：

~~~bash
curl http://127.0.0.1:8899/health
~~~

返回：

~~~json
{
  "ok": true,
  "service": "dy-live-server"
}
~~~

## DYYY

~~~text
GET /api/dyyy?url=<Douyin URL>
~~~

示例：

~~~text
https://ts.tailc27773.ts.net/api/dyyy?url=
~~~

DYYY 会把抖音分享地址追加到 `url=` 后面。

## Live Photo返回字段

~~~text
images[]
live_videos[]
video_list[]
title
item_id
~~~

其中：

~~~text
images[n]
~~~

对应：

~~~text
live_videos[n]
~~~

两者共同组成第 n 张 Live Photo。

## Media Proxy

图片：

~~~text
/media/image/<id>.jpg
~~~

实况视频：

~~~text
/media/live/<id>.mp4
~~~
