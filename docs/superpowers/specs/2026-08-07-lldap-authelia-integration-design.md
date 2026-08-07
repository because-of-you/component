# LLDAP 与 Authelia 集成设计

## 目标

在现有 Helmfile 管理的 K3s `dev` 环境中新增 LLDAP，替换外部 OpenDirectory LDAP 服务。LLDAP 负责用户、密码和组目录，Authelia 继续负责登录门户、会话以及 Traefik ForwardAuth。

本次集成使用以下固定边界：

- LLDAP Web 管理入口为 `https://ldap.acitrus.cn`。
- LDAP Base DN 为 `dc=acitrus,dc=cn`。
- LLDAP 数据存入现有 PostgreSQL，但使用独立的 `lldap` 数据库。
- PostgreSQL 继续复用现有 `postgres` 账号和 `postgresql-auth` Secret 中的密码。
- LDAP 端口只通过 ClusterIP 在集群内部提供，不对公网暴露。
- 用户自行在 LLDAP Web 管理界面创建；仓库不声明或保存个人用户密码。

## 方案选择

采用仓库自有的最小 LLDAP Helm Chart，路径为 `charts/lldap`。

没有采用第三方 `Evantage-WS/lldap-kubernetes` Chart，因为它的镜像、HPA、PVC、示例凭据和 cert-manager 默认值需要大量覆盖，最终维护成本不低于本地 Chart。也不直接提交 Kubernetes manifests，以保持现有 Helmfile、环境 values、测试和 OCI Chart 的一致结构。

## 组件与依赖关系

LLDAP release 部署到 `infra` 命名空间，并在 `helmfile.yaml` 中声明对 PostgreSQL 的依赖。Authelia 则依赖 LLDAP：

```text
PostgreSQL -> LLDAP -> Authelia
```

LLDAP Chart 创建以下资源：

- 单副本 `Deployment/lldap`。
- 同时暴露 LDAP `3890` 和 Web `17170` 的 `ClusterIP Service/lldap`。
- 将 Web 端口路由到 `ldap.acitrus.cn` 的 Traefik `IngressRoute`。
- 幂等创建 PostgreSQL 数据库的 Helm pre-install/pre-upgrade Hook Job。
- 幂等创建 Authelia 只读绑定账号的 Helm post-install/post-upgrade Hook Job。

部署使用官方 `lldap/lldap:stable-alpine-rootless` 镜像。设计时官方最新稳定版本为 LLDAP `v0.6.3`。Chart 默认单副本运行，不启用 HPA。

## 数据库

LLDAP 使用如下数据库连接：

```text
postgres://postgres:<URL-encoded password>@postgresql.infra.svc.cluster.local:5432/lldap
```

完整连接串只保存在 `infra/lldap-secrets` 的 `database-url` 键中。GitHub Actions 使用现有 `POSTGRES_PASSWORD` 生成连接串，并在拼接前对密码进行 URL 编码，避免特殊字符破坏 URI。

数据库初始化 Job 使用与现有数据库主版本一致的 PostgreSQL 18 客户端，读取 `postgresql-auth/postgres-password`，先查询 `lldap` 数据库是否存在，仅在缺失时执行创建。Job 可在每次安装和升级前重复运行，不删除或重建已有数据库。

由于数据存入 PostgreSQL 且配置全部来自环境变量，LLDAP 不创建 PVC，也不持久化 `/data`。Pod 重建不会丢失用户数据。

## Secret 设计

GitHub `dev` Environment 新增以下 Secrets：

- `LLDAP_JWT_SECRET`
- `LLDAP_KEY_SEED`
- `LLDAP_ADMIN_PASSWORD`
- `LLDAP_AUTHELIA_PASSWORD`

继续复用已有 `POSTGRES_PASSWORD`。这些值由 dev 部署工作流同步到 `infra/lldap-secrets`，仓库的 values、测试夹具和文档不包含真实值。

`lldap-secrets` 至少包含以下键：

| 键 | 用途 |
| --- | --- |
| `jwt-secret` | LLDAP Web 会话 JWT 签名 |
| `key-seed` | LLDAP 密码相关密钥派生种子 |
| `admin-password` | LLDAP 内置 `admin` 管理员密码 |
| `authelia-password` | Authelia LDAP 只读服务账号密码 |
| `database-url` | 包含 PostgreSQL 凭据的完整连接串 |

Deployment 使用逐项 `secretKeyRef` 映射为 LLDAP 所需的 `LLDAP_JWT_SECRET`、`LLDAP_KEY_SEED`、`LLDAP_LDAP_USER_PASS` 和 `LLDAP_DATABASE_URL`，避免把敏感值放进 Pod 模板或 Helm release values。

更新 LLDAP Secret 后，部署工作流会重启已存在的 LLDAP Deployment 并等待其就绪，再执行 Helm 同步和 bootstrap。这样管理员密码轮换时，bootstrap Job 不会拿新密码访问仍使用旧环境变量的 Pod。

## 管理员与 Authelia 服务账号

LLDAP 保留内置管理员用户名 `admin`。管理员只用于登录 `https://ldap.acitrus.cn` 管理用户和组，Authelia 不使用此高权限账号。

LLDAP 官方镜像自带 `/app/bootstrap.sh`。Chart 的 bootstrap Hook 使用该脚本声明并维护以下机器账号：

```text
username: authelia
DN: uid=authelia,ou=people,dc=acitrus,dc=cn
group: lldap_strict_readonly
```

bootstrap 配置使用 `LLDAP_AUTHELIA_PASSWORD` 设置账号密码，并保持 `DO_CLEANUP=false`，因此不会删除管理员手工创建的用户或组。该账号只允许 Authelia 查询用户、邮箱和组，不能创建、删除或修改目录条目。

个人账号（例如 `wfy`）不纳入 bootstrap。部署完成后由管理员在 LLDAP Web UI 中创建并设置全新密码。

## Authelia 配置

Authelia 的 LDAP 后端改为原生 LLDAP 模板：

```yaml
authentication_backend:
  ldap:
    enabled: true
    implementation: lldap
    address: ldap://lldap.infra.svc.cluster.local:3890
    base_dn: dc=acitrus,dc=cn
    user: uid=authelia,ou=people,dc=acitrus,dc=cn
```

绑定密码继续通过现有 `authelia-secrets` 的 `authentication.ldap.password.txt` 提供，但其 GitHub Secret 来源改为 `LLDAP_AUTHELIA_PASSWORD`。删除 OpenDirectory 专用的 `additional_users_dn`、用户/组过滤器、属性映射和 StartTLS 配置，由 `implementation: lldap` 提供正确默认值。该实现允许用户使用用户名或邮箱登录。

Authelia 现有密码修改和密码重置入口保持关闭，因此 `authelia` 账号只需要 `lldap_strict_readonly` 权限。用户密码由 LLDAP 管理页面设置。

集群内的 LDAP 使用明文 `ldap://`，但服务仅为 ClusterIP，不经 Traefik 对外开放；LLDAP 的 LDAPS 功能不启用。面向浏览器的 LLDAP Web UI 仍通过 Traefik 和现有 ACME resolver 使用 HTTPS。

## Web 入口与运行安全

Traefik `IngressRoute` 使用：

- Host：`ldap.acitrus.cn`
- EntryPoint：`websecure`
- TLS resolver：`leresolver`
- 后端：`lldap:17170`

LLDAP Web UI 使用自身登录，不挂载 Authelia ForwardAuth Middleware，避免 LLDAP 与 Authelia 之间形成循环认证或双重登录。

Pod 使用 rootless 镜像和非 root security context，禁止提权并丢弃不需要的 Linux capabilities。LDAP 和 Web 端口均配置 TCP startup/readiness/liveness 探针；资源默认值按单用户小型集群设置，并允许环境 values 覆盖。

## dev 自动部署

`.github/workflows/deploy-dev.yaml` 增加 `lldap` 组件：

- push 路径包含 `charts/lldap/**` 和 `environments/dev/lldap/**`。
- `workflow_dispatch` 下拉选项增加 `lldap`。
- `infra` namespace 初始化条件包含 `lldap`。
- LLDAP Matrix Job 同步 `lldap-secrets`，必要时重启旧 Deployment，然后执行 `helmfile -e dev --selector name=lldap sync`。
- Authelia Secret 同步步骤使用 `LLDAP_AUTHELIA_PASSWORD` 写入 `authentication.ldap.password.txt`。

只修改 LLDAP Chart 或 dev values 时只部署 LLDAP；只修改 Authelia 文件时只部署 Authelia。修改 `helmfile.yaml`、`environments/dev/values.yaml` 或部署 workflow 等共享文件时，所有已注册组件仍按现有规则分别进入 Matrix，因此首次集成提交会触发多个组件。

GitHub Actions 不会因 Environment Secret 本身变化自动运行。轮换 `LLDAP_AUTHELIA_PASSWORD` 时，先手动部署 `lldap`，再手动部署 `authelia`，确保服务账号密码和 Authelia Secret 一致。

## 卸载和数据清理

普通卸载 LLDAP release 时删除 Deployment、Service、IngressRoute 和 Helm 管理的 Hook 资源，但保留：

- 工作流创建的 `infra/lldap-secrets`。
- PostgreSQL 内的 `lldap` 数据库。

这样重新安装 LLDAP 可以直接恢复用户和组。完整清理需要显式删除 `lldap-secrets` 并通过 PostgreSQL 管理连接删除 `lldap` 数据库，README 将提供命令。

LLDAP 没有独立 PVC。删除 PostgreSQL PVC 会同时删除 PostgreSQL 中的 Authelia、LLDAP 及其他数据，因此 LLDAP 的清理命令不会自动删除 PostgreSQL PVC。

## 失败与恢复行为

- PostgreSQL 不可用或密码不一致时，数据库初始化 Hook 失败，Helm 原子安装或升级回滚，不启动使用错误连接的 LLDAP。
- `lldap` 数据库已存在时，初始化 Hook 成功跳过，不破坏已有数据。
- LLDAP 未就绪或管理员密码错误时，bootstrap Hook 失败，Helm 明确报告失败。
- bootstrap 重复执行时更新 `authelia` 服务账号到声明状态，但不清理其他目录数据。
- Authelia 无法连接 LLDAP 或绑定密码不一致时不会放行认证请求；修复 Secret 后依次重部署 LLDAP 和 Authelia。
- LLDAP Web 路由异常不影响集群内 LDAP Service；LDAP Service 异常时 Authelia 登录失败并通过日志暴露原因。

## 验证

实现完成后执行以下验证：

- `helm lint charts/lldap -f environments/dev/lldap/values.yaml`。
- `helm template` 验证 Deployment、双端口 Service、IngressRoute、Secret 引用、数据库 Hook 和 bootstrap Hook。
- 断言渲染结果不包含 LLDAP PVC、明文 Secret 或公网 LDAP 路由。
- 验证缺少必要 existing Secret 名称或必要非敏感配置时 Helm 给出明确错误。
- 更新 Authelia 渲染测试，断言 `implementation: lldap`、内部地址、Base DN 和只读绑定 DN。
- 更新部署工作流测试，确认 LLDAP 路径只选择 `lldap`，共享路径仍选择全部组件。
- 分别执行 `helmfile -e dev template --selector name=lldap --skip-deps` 和 Authelia selector 渲染。
- 扫描差异，确认旧 OpenDirectory 地址、DN、过滤器和用户提供过的真实密码均未进入仓库。

部署后的运行验收包括：

1. `https://ldap.acitrus.cn` 可使用新管理员密码登录。
2. 创建 `wfy` 用户并设置新密码。
3. `wfy` 可在 `https://auth.acitrus.cn` 使用用户名或邮箱完成 1FA。
4. Authelia 能读取 LLDAP 组；`authelia` 服务账号不能修改目录。
5. 重启 LLDAP Pod 后用户、组和密码仍然存在。
