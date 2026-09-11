# Surge + Tailscale

当前 Surge：

~~~ini
[Proxy]
iOS Tailnet = tailscale, section-name=14pm-tailnet

[Tailscale 14pm-tailnet]
interactive-login = true
hostname = surge-14pm
idle-keepalive = -1
auto-add-magic-dns-rule = true
~~~

推荐显式规则：

~~~ini
[Rule]

# 当前tailnet MagicDNS
DOMAIN-SUFFIX,tailc27773.ts.net,iOS Tailnet

# Ubuntu Tailscale IP
IP-CIDR,100.74.54.32/32,iOS Tailnet,no-resolve
~~~

如果 Windows 也加入同一个 tailnet：

~~~ini
IP-CIDR,<Windows Tail IP>/32,iOS Tailnet,no-resolve
~~~

如果所有所需 Tail IP 已经使用 /32 精确分流，
剩余 CGNAT 网段可以根据自己的 Surge 配置处理。

注意：

~~~text
规则顺序非常重要。
/32 Tailnet规则必须放在更宽泛的
100.64.0.0/10规则之前。
~~~

DYYY 使用：

~~~text
https://ts.tailc27773.ts.net/api/dyyy?url=
~~~
