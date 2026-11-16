# vpn-gateway：Tailscale 到 OpenVPN 的网关

此 Chart 创建一个单副本 Deployment。Tailscale 与 OpenVPN 3 共享 Pod 网络；OpenVPN 配置保存在已有 Secret 中。容器启动 D-Bus 并导入配置，由用户执行 `openvpn3 session-start` 并输入密码与 MFA；VPN 由 OpenVPN 3 后台服务维持，容器前台在检测到会话后转发实时日志。Tailscale 不使用 Auth key，需手动登录并发布 IPv4 路由。Tailscale 状态保存在 Pod 的临时卷中：容器重启可保留状态，Pod 重建后需要重新登录并重新发布路由；旧设备可能仍在管理后台，需手动清理。本方案不支持多个副本共享同一身份。

**当前实现尚未在 Docker、K3s 或你的 MFA 服务上实测。**请先在非生产环境完成下文验证；不要把 Pod Running 视为连接可用或断线保护已验证。

**部署前必须先完成下文准备**：`vpn-pyrl` 已注册在 Helmfile 和 dev 自动部署流水线中；相关 Chart 或 values 推送到 dev 会触发部署。如果镜像和 Secret 尚未准备好，部署会失败。

## 前置条件

- Linux K3s 节点存在 `/dev/net/tun`，允许容器使用 `NET_ADMIN`、访问该设备及执行 iptables/ip6tables。
- Pod 配置 `net.ipv4.ip_forward=1`；这是 Kubernetes 的 unsafe sysctl，必须在可能调度此 Pod 的每个 kubelet 上显式允许 `net.ipv4.ip_forward`。例如 K3s 的 kubelet 参数 `allowed-unsafe-sysctls=net.ipv4.ip_forward`。修改节点配置和重启服务前请查阅所用 K3s 版本的文档，确认是否已有其他允许项，避免覆盖。
- 集群网络插件和安全策略允许上述配置，节点可访问 OpenVPN 服务端和 Tailscale。`hostPath` 依赖节点设备，请按需用 `nodeSelector` 约束节点。
- 目标地址不能与客户端、集群或其他 VPN 的网络发生有影响的重叠。此方案仅转发 IPv4。
- 登录 Tailscale 的账号需有权将设备加入 tailnet；是否需要设备审批取决于 tailnet 设置。可选创建独立的 `tag:vpn-gateway` 并检查该账号是否有权分配此标签，不要使用 CI 的 `tag:ci-deploy`。

## 1. 准备镜像

`images/vpn-gateway/Dockerfile` 基于 Debian 12，使用 OpenVPN 官方稳定软件仓库安装 OpenVPN 3 Linux、D-Bus 和网络工具。项目的 `images/vpn-gateway/images.yaml` 已接入 Sync Images 流水线；变更推送到 dev 后将构建并发布镜像到 `registry.cn-shenzhen.aliyuncs.com/gravitation/vpn-gateway:3.0.0`。dev 环境 values 使用该地址。首次部署前需确保工作流已成功且节点有拉取权限。也可以自行构建、推送到节点可访问的私有镜像仓库，再修改 values：

```bash
docker build -t <你的镜像仓库>/vpn-gateway:3.0.0 images/vpn-gateway
docker push <你的镜像仓库>/vpn-gateway:3.0.0
```

如需镜像仓库认证，应按集群已有方式配置拉取凭据。Tailscale 镜像也必须可从节点拉取。部署工作流会等待指定镜像标签存在，但不能证明同名标签已被本次构建更新。后续修改镜像时应使用新标签并同步更新镜像清单、values 和部署工作流；确认新镜像发布成功后再部署。单独修改镜像文件只触发构建，不自动重启 VPN。

## 2. 在私有目录准备 OpenVPN 配置

准备 `client.ovpn` 及其引用的全部文件，注意使用 `/etc/openvpn/client/` 下的绝对路径，或将证书内联。确认服务端和客户端使用 TUN 模式。密码和一次性验证码由你交互输入，不应保存到 Secret。具体 MFA 挑战方式是否受容器里的 OpenVPN 3 命令行客户端支持，需要向 VPN 提供方确认并实际测试；Windows GUI 能登录不保证命令行一定兼容。

OpenVPN 3 不支持 OpenVPN 2 的全部配置项，也不支持用 `auth-user-pass` 明文文件自动载入凭据；不能直接假定先前 OpenVPN 2 的 `route-nopull` 或路由示例可用。先在隔离环境验证导入、认证、服务器推送的路由、目标路由及 Tailscale 控制连接；如果 OpenVPN 接管默认路由，可能导致 Tailscale 断连。仅在确认本次实际配置的目标路由正确后再批准 Tailscale 路由。本 Chart 不支持 IPv6 目标转发。

## 3. 创建 Secret

以下在有集群访问权限的终端执行。请限制私有文件的权限，并保留安全备份；删除 Secret 或重建集群后必须重新创建。

```bash
kubectl create namespace openvpn --dry-run=client -o yaml | kubectl apply -f -

# 私有目录内包含 client.ovpn 以及配置引用的证书、密钥和密码文件。
kubectl -n openvpn create secret generic vpn-pyrl-openvpn \
  --from-file=./openvpn-private

```

`openvpn-private` 只放需要的文件；Secret 数据及集群路由仍对有足够权限的人可见。确保 RBAC、etcd 加密与备份符合你的要求。

## 4. 部署及批准路由

首次使用下面的手动安装命令，让 Helm 不等待登录。Tailscale 容器会等待手动登录；现有 Helmfile 和 GitHub Actions 使用 `wait` 和 `atomic`，如果等待超时可能回滚，因此首次不建议通过流水线部署。流水线的 CI 身份只用于连接 Kubernetes，不会为网关 Pod 登录。

```bash
helm upgrade --install vpn-pyrl ./charts/vpn-gateway \
  -n openvpn --create-namespace -f environments/dev/vpn-pyrl/values.yaml
kubectl -n openvpn get pods -l app.kubernetes.io/instance=vpn-pyrl
kubectl -n openvpn logs deployment/vpn-pyrl -c tailscale
```

待 Pod 启动、日志显示已导入配置后，在可信终端手动启动 OpenVPN 3 会话：

```bash
kubectl -n openvpn exec -it deploy/vpn-pyrl -c openvpn -- \
  openvpn3 session-start --config vpn-pyrl
```

按提示输入密码和 MFA，必要时输入用户名；不要在命令参数中写密码或验证码。OpenVPN 3 启动会话成功、命令返回后，可以关闭终端。查看会话及实时日志：

```bash
kubectl -n openvpn exec deploy/vpn-pyrl -c openvpn -- openvpn3 sessions-list
kubectl -n openvpn logs -f deployment/vpn-pyrl -c openvpn
```

前台进程在检测到会话后连接 `openvpn3 log`，只输出连接后的实时事件，不能保证捕获更早的认证日志；断开后会等待并尝试重新连接日志。Pod 或 OpenVPN 容器重建会停止会话，需要重新认证；服务端要求重新认证或网络异常也可能中断连接。Kubernetes 的 Running 状态不表示 VPN 已连接。

在另一个终端运行以下命令登录 Tailscale；将占位符换成目标 IPv4 CIDR，多个路由以英文逗号分隔，且不要包含默认路由。命令中的 IP 可能进入本机 shell 历史，因此请在可信终端操作。

```bash
kubectl -n openvpn exec -it deploy/vpn-pyrl -c tailscale -- \
  tailscale up --advertise-routes=<目标IPv4/CIDR>
```

根据终端输出打开登录链接完成授权。如果命令等待时间过长，另开终端查看 `kubectl -n openvpn logs deployment/vpn-pyrl -c tailscale`。如需标签，确保账号具备标签分配权限，再在上述 `tailscale up` 命令中增加 `--advertise-tags=tag:vpn-gateway`；普通手动登录并不会自动应用该标签。

请在 Tailnet 管理后台确认设备已加入并批准它发布的子网路由，或预先配置适用的自动批准策略。Tailscale Linux 客户端可能需启用 `--accept-routes`。路由和访问策略还要允许客户端访问对应地址。手动登录通常创建普通设备，Pod 消失后请在管理后台自行删除旧设备，不要依赖自动清理。

## 5. 验证与维护

检查 Pod 中到目标地址的实际路由，应走 OpenVPN 的 `tun` 接口：

```bash
kubectl -n openvpn exec deploy/vpn-pyrl -c openvpn -- ip route get <目标IPv4>
```

从 Tailscale 客户端测试目标服务，再用无关地址检查其他流量仍走本地。防火墙规则限制**已经到达 Pod 的转发流量**只能从 `tun` 接口出去，IPv6 转发被丢弃；请在非生产环境实际断开 OpenVPN 并检查它不能通过普通网络转发。若整个 Pod 消失，客户端可能回退到本地路由；若绝不能直连，还需要客户端防火墙。当前没有对 VPN 连通性进行就绪探测，不提供自动故障切换。

更新 OpenVPN Secret 后重启 Deployment：

```bash
kubectl -n openvpn rollout restart deployment/vpn-pyrl
kubectl -n openvpn rollout status deployment/vpn-pyrl
```

`kubectl create secret` 仅供首次创建；更新时使用安全的 Secret 管理方式，避免输出实际内容。重启 Deployment 会重建 Pod，因此还需要重新手动启动 OpenVPN 并完成 MFA、重新运行 `tailscale up` 登录并发布路由，再检查旧设备和路由审批。新网关可以复制一份环境 values、使用独立 Secret 和 Tailscale 设备名，并在 Helmfile 注册新的 release。不要让两个不同 VPN 同时发布相同目标路由，除非明确设计了相同目标和故障切换策略。

## 安全边界

- `NET_ADMIN` 和 TUN 设备是网关功能所需的高权限，不能视为普通应用。限制谁能在 `openvpn` 创建或修改 Pod、读取 Secret、执行 `pods/exec`，也要限制谁能更改镜像与 OpenVPN 配置。命名空间本身不是完整的隔离边界。
- Tailscale 与防火墙初始化容器丢弃不需要的默认能力并禁止提权。OpenVPN 3 容器为 D-Bus 激活和多用户服务保留默认容器能力，并允许权限提升，额外添加 `NET_ADMIN`、`NET_RAW`；它比之前的 OpenVPN 2 容器权限更宽，仍未使用 privileged 或 hostNetwork。必须验证你的运行时和集群策略，后续可在实测基础上继续缩小能力集。
- 防火墙的出口约束适用于从 `tailscale0` 进入 Pod 并经过转发的流量，不限制容器自身发起的连接，也不保证客户端在网关离线时不会直连。规则允许匹配 `tun+` 的接口，而不验证 VPN 服务端身份。容器持有 `NET_ADMIN`，被入侵时可改变路由和防火墙。
- 此 Chart 没有自动阻断通往 Pod 本身的连接，也没有配置 Tailscale 访问策略。务必限制哪些 tailnet 身份可访问网关和所发布的目标，必要时由管理员另行设置经过 CNI 验证的网络策略。
- OpenVPN 配置及其引用的脚本必须来自可信来源；使用证书验证服务端身份。Secret 未自动提供端到端保密，限制 RBAC 并配置 etcd 加密及私有备份。镜像应使用可信仓库并核验 digest，定期更新与扫描；示例镜像标签没有锁定 digest。
- 首次部署、VPN 断开、Pod 删除及配置更新后都应在非生产环境实测转发和客户端路由。当前没有 VPN 连通性探测，Kubernetes 显示 Running 不代表 VPN 连接正常。

从此前 `infra` 配置迁移时，请先在 `openvpn` 中重新创建 Secret，并按上面的安装与登录步骤验证。两个命名空间里的 Helm release 和设备互相独立；确认新网关可用且不再需要旧网关后，再手动处理旧 release 和旧设备，避免同时发布冲突路由。
