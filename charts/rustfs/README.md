# RustFS

这个 Chart 封装官方 RustFS Helm Chart `1.0.0-rc.4`，并追加本仓库使用的 Traefik HTTP
`IngressRoute`。上游 Chart 与 RustFS 镜像都固定为 `1.0.0-rc.4`，升级时必须同步更新。

## dev 拓扑

- namespace：`infra`
- mode：standalone
- data PVC：`local-path` / `10Gi`
- log PVC：`local-path` / `1Gi`
- 控制台：`https://s3.acitrus.cn`
- S3 API Endpoint：`https://s3.acitrus.cn:1024`

上游 Chart 保持只读根文件系统。dev 额外挂载一个大小上限为 `2Gi` 的临时 `emptyDir` 到
`/tmp`，并设置 `TMPDIR=/tmp`，供 RustFS 创建 ZIP 等请求级临时文件。临时卷不保存对象数据，
Pod 重建时会自动清空；对象数据仍只保存在 data PVC 中。

控制台通过 Traefik `websecure` 入口转发到服务端口 `9001`；S3 API 通过共享的
`gravitation` 入口转发到服务端口 `9000`。两条路由都是由 Traefik 终止 TLS 的 HTTP
`IngressRoute`，RustFS 不使用 `IngressRouteTCP`，也不会改变 Redis、PostgreSQL 或 RabbitMQ
已有的 TCP 路由。

## 凭证

GitHub `dev` Environment 必须配置以下四项 Secret：

- `RUSTFS_ACCESS_KEY`
- `RUSTFS_SECRET_KEY`
- `RUSTFS_OIDC_CLIENT_SECRET`
- `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`

部署工作流会把 Access Key、Secret Key 和 OIDC 明文客户端密钥同步到
`infra/rustfs-secrets`。OIDC 明文和 Digest 必须由同一次 Authelia CLI 命令生成：明文保存为
`RUSTFS_OIDC_CLIENT_SECRET` 并供 RustFS 使用，PBKDF2 摘要保存为
`RUSTFS_OIDC_CLIENT_SECRET_DIGEST` 并供 Authelia 使用。生成及轮换命令见
[`charts/authelia/README.md`](../authelia/README.md)。真实密钥和摘要不得写入 values 或提交到仓库。

wrapper 默认引用 `rustfs-secrets`，但不会创建这个 Secret。GitHub dev 部署工作流会自动同步它；
手动执行本地安装、OCI 安装或 `helmfile apply` 前，必须先在 release 所在命名空间创建 Secret，或者
通过 values 把 `rustfs.secret.existingSecret` 改为已有的 Secret 名称。该 Kubernetes Secret 必须包含
以下三个 data key：

- `RUSTFS_ACCESS_KEY`
- `RUSTFS_SECRET_KEY`
- `RUSTFS_IDENTITY_OPENID_CLIENT_SECRET`

其中 `RUSTFS_IDENTITY_OPENID_CLIENT_SECRET` 的内容对应 GitHub Secret
`RUSTFS_OIDC_CLIENT_SECRET`。下面的示例从本地文件创建 Secret，不把凭证值放进命令行或 shell
历史。先用受信任的编辑器或 Secret 管理工具，在仓库外的受保护目录中创建三个同名文件；把
`credentials_dir` 改为该目录后再执行，并在完成后按本地安全策略清理这些文件：

```bash
credentials_dir="/path/outside/repository/rustfs"
test -f "$credentials_dir/RUSTFS_ACCESS_KEY"
test -f "$credentials_dir/RUSTFS_SECRET_KEY"
test -f "$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET"

kubectl create namespace infra --dry-run=client -o yaml \
  | kubectl apply -f -
kubectl -n infra create secret generic rustfs-secrets \
  --from-file=RUSTFS_ACCESS_KEY="$credentials_dir/RUSTFS_ACCESS_KEY" \
  --from-file=RUSTFS_SECRET_KEY="$credentials_dir/RUSTFS_SECRET_KEY" \
  --from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET="$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET" \
  --dry-run=client -o yaml \
  | kubectl apply -f -
```

若使用其他 Secret 名称，在传给 Chart 的 values 中显式覆盖：

```yaml
rustfs:
  secret:
    existingSecret: my-rustfs-secrets
```

## OIDC

Authelia Client ID 是 `rustfs-console`，使用 `client_secret_post` 和 PKCE `S256`，回调地址固定为：

```text
https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default
```

dev 环境中的 `auth.acitrus.cn` 解析到 Tailscale `100.64.0.0/10` 地址，因此通过精确的
`RUSTFS_OUTBOUND_ALLOW_ORIGINS=https://auth.acitrus.cn` 白名单允许 RustFS 访问该可信 OIDC origin；
不要把整个私网地址段加入白名单。

dev 环境设置了 `RUSTFS_IDENTITY_OPENID_ROLE_POLICY=consoleAdmin`。这意味着任何能够通过该
OIDC Client 登录的用户都会获得 RustFS 控制台管理权限；这个宽松策略仅适用于开发环境，不能直接
照搬到生产环境。

RustFS 的外部依赖仅包括用于控制台登录的 Authelia；对象数据和日志保存在本地 PVC 中，不需要
PostgreSQL 或 Redis。

## 渲染与部署

```bash
helm dependency update charts/rustfs
helm lint charts/rustfs -f environments/dev/rustfs/values.yaml
bash charts/rustfs/tests/render.sh
helmfile -e dev template --selector name=rustfs --skip-deps
helmfile -e dev apply --selector name=rustfs
```

`--skip-deps` 要求依赖已下载；修改 `Chart.yaml` 或上游版本后，应先重新执行
`helm dependency update charts/rustfs`。

## S3 验证

S3 客户端 Endpoint 必须包含端口：`https://s3.acitrus.cn:1024`。当前配置只支持路径风格访问，
例如 `https://s3.acitrus.cn:1024/my-bucket/my-object`；不要配置虚拟主机风格，也不要使用
`bucket.s3.acitrus.cn`。Chart 没有设置 `RUSTFS_SERVER_DOMAINS`，证书也不包含
`*.s3.acitrus.cn`。

可以使用任意支持自定义 Endpoint 和路径风格的 S3 客户端，以
`RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` 对应的凭证完成建桶、上传、下载和删除对象验证。

## 卸载、保留与清理

卸载 release 前先检查上游 Chart 对 PVC 的资源保留策略，并记录当前 PVC：

```bash
kubectl -n infra get pvc
helmfile -e dev destroy --selector name=rustfs
kubectl -n infra get pvc
```

wrapper 不创建自动删除 PVC 的 Hook。卸载后如果 PVC 被保留，对象数据和日志仍会占用存储；确认
开发数据不再需要后，才应按准确的 PVC 名称手动删除。删除 PVC 会永久删除相应的 RustFS 对象或
日志，无法通过重新安装 release 恢复。清理时只删除 RustFS 自己的 PVC，不要使用宽泛标签或通配符，
以免误删 `infra` 中其他组件的持久卷。
