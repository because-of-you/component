# RustFS Chart 集成设计

## 目标

在现有 Helm Charts 仓库中增加可独立检查、打包、发布和部署的 RustFS 组件。dev 环境使用单机模式，复用现有 Traefik 与 Authelia，通过同一个域名的不同外部端口分别提供控制台和 S3 API。

## 范围

本次包含：

- 封装 RustFS 官方 Helm Chart。
- 为 dev 环境维护部署参数。
- 创建控制台和 S3 API 的 Traefik `IngressRoute`。
- 将 RustFS 注册为 Authelia OIDC Client。
- 通过 GitHub Actions 同步 RustFS 与 Authelia 所需凭证。
- 接入 Helmfile、dev 部署工作流、镜像同步、渲染测试与仓库文档。

本次不包含：

- 分布式 RustFS、服务器池或 Operator。
- PostgreSQL、Redis 事件通知或审计目标。
- 虚拟主机风格 Bucket 域名。
- 按 LLDAP 组进行细粒度 RustFS 策略映射。
- 生产环境拓扑、备份和容灾方案。

## Chart 结构

新增 `charts/rustfs` wrapper Chart，固定依赖 RustFS 官方仓库 `https://charts.rustfs.com` 的 Chart `1.0.0-rc.1`。wrapper 只维护本项目的通用默认值、自定义 Traefik 资源、测试和文档，不复制上游模板。

环境相关配置放在 `environments/dev/rustfs/values.yaml`。上游 Chart 的内置 Ingress 与 Gateway API 均关闭，避免与 wrapper 维护的 Traefik CRD 重复。

RustFS release 名为 `rustfs`，部署到 `infra` 命名空间。Helmfile 声明其依赖 `infra/authelia`，以确保部署 RustFS 时 OIDC Provider 已存在。

## 部署与存储

dev 使用上游 Chart 的 standalone 模式：

- 一个 Deployment、一个 RustFS Pod。
- `local-path` StorageClass。
- 数据 PVC 为 `10Gi`。
- 日志 PVC 为 `1Gi`，日志目录保留上游默认 `/logs`。
- Service 保持 `ClusterIP`，S3 API 使用端口 `9000`，控制台使用端口 `9001`。
- 不创建 PodDisruptionBudget。

单机模式不提供节点故障冗余，适用于个人开发和功能验证。wrapper 不增加任何自动删除 PVC 的 Hook；README 必须说明上游 Chart 的实际卸载行为，并明确区分 release 卸载与显式 PVC 删除。

## 网络入口

同一个域名使用不同 Traefik EntryPoint：

| 用途 | 外部地址 | EntryPoint | RustFS Service 端口 |
| --- | --- | --- | --- |
| 控制台与 OIDC 回调 | `https://s3.acitrus.cn` | `websecure`（443） | `9001` |
| S3 API | `https://s3.acitrus.cn:1024` | `gravitation`（1024） | `9000` |

两个入口均为 HTTP `IngressRoute` 并由 Traefik 终止 TLS，使用 `leresolver`。S3 API 不使用 `IngressRouteTCP`。当前 Redis、PostgreSQL 和 RabbitMQ 的 TCP Router 使用各自精确的 `HostSNI`，不存在 `HostSNI(*)`，因此 `s3.acitrus.cn` 的 HTTP Router 可以安全复用 `gravitation` EntryPoint。

本次只支持路径风格 S3 Endpoint，例如 `https://s3.acitrus.cn:1024/bucket/key`。不设置 `RUSTFS_SERVER_DOMAINS`，也不申请 `*.s3.acitrus.cn` 证书。

## OIDC

Authelia 新增专用 Client `rustfs-console`，不复用 Claude Code Hub Client：

- Authorization Code Flow。
- PKCE 必须启用并固定为 `S256`。
- Token Endpoint Auth Method 为 `client_secret_post`。
- 回调地址为 `https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default`。
- Scopes 为 `openid`、`profile`、`email` 和 `groups`。
- ID Token 输出 `email`、`email_verified`、`groups`、`name` 与 `preferred_username`。

RustFS 使用以下非敏感设置：

```text
RUSTFS_BROWSER_REDIRECT_URL=https://s3.acitrus.cn
RUSTFS_IDENTITY_OPENID_ENABLE=on
RUSTFS_IDENTITY_OPENID_CONFIG_URL=https://auth.acitrus.cn
RUSTFS_IDENTITY_OPENID_CLIENT_ID=rustfs-console
RUSTFS_IDENTITY_OPENID_SCOPES=openid,profile,email,groups
RUSTFS_IDENTITY_OPENID_REDIRECT_URI=https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default
RUSTFS_IDENTITY_OPENID_REDIRECT_URI_DYNAMIC=off
RUSTFS_IDENTITY_OPENID_DISPLAY_NAME=Authelia
RUSTFS_IDENTITY_OPENID_GROUPS_CLAIM=groups
RUSTFS_IDENTITY_OPENID_EMAIL_CLAIM=email
RUSTFS_IDENTITY_OPENID_USERNAME_CLAIM=preferred_username
RUSTFS_IDENTITY_OPENID_ROLE_POLICY=consoleAdmin
```

`RUSTFS_IDENTITY_OPENID_ROLE_POLICY=consoleAdmin` 是 dev 环境捷径：任何成功通过该 Client 登录的用户都会获得 RustFS 管理权限。正式环境应移除此设置，改为让 OIDC `groups` 或 `roles` 声明与 RustFS IAM 策略名称精确匹配。

由于 dev 为单 Pod，不需要额外配置 OIDC 回调粘性会话。未来切换为分布式模式时，必须保证授权请求与回调落到同一个 RustFS Pod。

## Secret 与部署工作流

GitHub `dev` Environment 增加：

- `RUSTFS_ACCESS_KEY`
- `RUSTFS_SECRET_KEY`
- `RUSTFS_OIDC_CLIENT_SECRET`
- `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`

OIDC 明文 Secret 与 PBKDF2 Digest 必须由同一次 Authelia CLI 生成。明文只写入 `infra/rustfs-secrets`，Digest 只写入 `infra/authelia-secrets`。

`rustfs-secrets` 使用 RustFS 可直接通过 `envFrom` 读取的键名：

- `RUSTFS_ACCESS_KEY`
- `RUSTFS_SECRET_KEY`
- `RUSTFS_IDENTITY_OPENID_CLIENT_SECRET`

上游 Chart 设置 `secret.existingSecret=rustfs-secrets`。Secret 只包含凭证，不包含卷拓扑、地址或启动模式覆盖；standalone 模式不需要分布式 endpoint anchor。

Authelia Secret 增加 `identity_providers.oidc.clients.rustfs-console.secret.txt`。Authelia 部署步骤同步 RustFS Client Digest，RustFS 部署步骤同步 RustFS 明文凭证。更新任一 OIDC Secret 后，相应 Deployment 必须滚动重启。

## 镜像

RustFS 镜像与 Chart 固定为同一版本 `1.0.0-rc.1`。新增 `images/rustfs/images.yaml`：

- 来源：`docker.io/rustfs/rustfs:1.0.0-rc.1`
- 目标：`registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.1`

dev values 使用阿里云镜像地址。镜像同步继续由独立的 `Sync Images` 工作流负责，部署工作流不内嵌镜像复制逻辑。

## CI、验证与文档

新增 `charts/rustfs/tests/render.sh`，至少验证：

- wrapper 依赖版本和镜像版本一致。
- standalone 模式启用且 distributed 模式关闭。
- 数据与日志 PVC 分别为 `10Gi`、`1Gi`。
- 上游 Ingress 与 Gateway API 不渲染。
- 控制台 `IngressRoute` 使用 `websecure`、域名 `s3.acitrus.cn` 和端口 `9001`。
- S3 API `IngressRoute` 使用 `gravitation`、同一域名和端口 `9000`。
- S3 API 不渲染为 `IngressRouteTCP`。
- OIDC 非敏感环境变量正确，客户端密钥来自 `rustfs-secrets`。
- Helmfile、dev 路径过滤、手动部署选项、Secret 同步和镜像清单均已接入。
- Authelia 渲染结果包含 `rustfs-console`、`client_secret_post`、PKCE S256 和精确回调地址。

README 说明安装、域名与端口、凭证生成、OIDC 权限、验证命令、S3 客户端 Endpoint、PVC 保留和完整清理风险。

## 验收标准

以下条件全部满足即认为实现完成：

1. `helm dependency update`、`helm lint`、`helm template` 和 RustFS render 测试通过。
2. dev 渲染结果只创建一个 RustFS Pod，并创建 `10Gi` 数据 PVC 与 `1Gi` 日志 PVC。
3. `https://s3.acitrus.cn` 能打开控制台并通过 Authelia 登录。
4. `https://s3.acitrus.cn:1024` 能通过 S3 客户端完成建桶、上传、下载和删除测试对象。
5. 现有 Redis、PostgreSQL 和 RabbitMQ 的 1024/TCP 路由规则保持不变。
6. 仓库中不出现任何真实访问密钥、客户端明文 Secret 或 PBKDF2 Digest。
