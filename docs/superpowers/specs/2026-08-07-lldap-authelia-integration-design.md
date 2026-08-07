# LLDAP 与 Authelia 集成设计

## 目标

在现有 Helmfile 管理的 K3s `dev` 环境中新增 LLDAP，替换外部 OpenDirectory。LLDAP 管理用户、密码和组，Authelia 继续负责登录、会话和 Traefik ForwardAuth。

固定配置如下：

- Web 管理入口：`https://ldap.acitrus.cn`
- LDAP Base DN：`dc=acitrus,dc=cn`
- PostgreSQL 数据库：独立的 `lldap` 数据库
- PostgreSQL 凭据：复用现有 `postgres` 账号和 `POSTGRES_PASSWORD`
- LDAP：仅集群内 `lldap.infra.svc.cluster.local:3890`

## Helm Chart 选择

使用 LLDAP 官方安装文档在 Kubernetes 章节推荐的 `Evantage-WS/lldap-kubernetes` Helm 仓库，不在本仓库重新实现 LLDAP Deployment、Service、PVC、HPA 或标准 Ingress。

Wrapper Chart `charts/lldap` 固定依赖：

```yaml
dependencies:
  - name: lldap
    version: 0.4.0
    repository: https://evantage-ws.github.io/lldap-kubernetes/
```

该 Chart 对应 LLDAP `0.6.2`。本仓库通过子 Chart values 覆盖其不适合当前集群的默认值：

- 镜像仓库覆盖为官方 `lldap/lldap`。
- 使用 rootless 稳定镜像标签。
- `replicaCount: 1`。
- 关闭 HPA。
- 关闭 SQLite PVC，改用 PostgreSQL。
- 使用外部 Kubernetes Secret，不提交 Chart 示例凭据。
- 使用上游标准 Ingress，并通过 Traefik annotations 启用 `websecure` 和 `leresolver`。
- 不开启 cert-manager 或 LDAPS。

Wrapper 自有模板只处理上游 Chart 不负责的本集群集成：幂等创建 PostgreSQL 数据库，以及幂等创建 Authelia 只读绑定账号。

## 数据库

LLDAP 使用：

```text
postgres://postgres:<URL-encoded password>@postgresql.infra.svc.cluster.local:5432/lldap
```

完整连接串保存在 `infra/lldap-secrets` 的 `database-url` 键。GitHub Actions 使用现有 `POSTGRES_PASSWORD` 生成连接串，并对密码进行 URL 编码。

Wrapper 的 pre-install/pre-upgrade Hook Job 使用 PostgreSQL 18 客户端，读取 `postgresql-auth/postgres-password`，仅在数据库不存在时创建 `lldap`。普通升级和重新安装不会重建或删除数据库。

上游 Chart 的 `persistence.enabled` 关闭，因此 LLDAP 不创建 PVC；目录数据全部由 PostgreSQL 持久化。

## Secret 与账号

GitHub `dev` Environment 新增：

- `LLDAP_JWT_SECRET`
- `LLDAP_KEY_SEED`
- `LLDAP_ADMIN_PASSWORD`
- `LLDAP_AUTHELIA_PASSWORD`

继续复用 `POSTGRES_PASSWORD`。工作流创建的 `infra/lldap-secrets` 包含上游 Chart 需要的键以及集成键：

- `lldap-jwt-secret`
- `lldap-key-seed`
- `lldap-ldap-user-name`
- `lldap-ldap-user-pass`
- `base-dn`
- `database-url`
- `authelia-password`

LLDAP 管理员用户名保留为 `admin`。管理员只登录 `https://ldap.acitrus.cn` 管理目录，不作为 Authelia 绑定账号。

Wrapper 的 post-install/post-upgrade Hook 调用官方镜像自带的 `/app/bootstrap.sh`，幂等维护：

```text
username: authelia
DN: uid=authelia,ou=people,dc=acitrus,dc=cn
group: lldap_strict_readonly
```

bootstrap 使用 `DO_CLEANUP=false`，不会删除 Web UI 中创建的个人用户和组。个人账号 `wfy` 部署后由管理员在 UI 中创建并设置全新密码。

## Authelia

Authelia 攡用原生 LLDAP 模板：

```yaml
authentication_backend:
  ldap:
    enabled: true
    implementation: lldap
    address: ldap://lldap.infra.svc.cluster.local:3890
    base_dn: dc=acitrus,dc=cn
    user: uid=authelia,ou=people,dc=acitrus,dc=cn
```

绑定密码来自 `LLDAP_AUTHELIA_PASSWORD`，写入现有 `authelia-secrets/authentication.ldap.password.txt`。删除 OpenDirectory 专用 StartTLS、过滤器和属性映射。密码修改和重置继续关闭，因此服务账号只需 `lldap_strict_readonly`。

LDAP 使用 ClusterIP 内部明文连接，不开放公网。浏览器访问 LLDAP Web UI 时由 Traefik 提供 HTTPS。LLDAP Web UI 不挂 Authelia ForwardAuth，避免循环认证和双重登录。

## Helmfile 与自动部署

Helmfile 顺序为：

```text
PostgreSQL -> LLDAP -> Authelia
```

`.github/workflows/deploy-dev.yaml` 新增独立 `lldap` Matrix 组件、路径过滤、手动部署选项和 Secret 同步。只修改 LLDAP Chart 或 dev values 时只部署 LLDAP；修改 Helmfile、共享 values 或 workflow 时仍按现有规则部署全部已注册组件。

更新 LLDAP Secret 后，工作流重启已有 LLDAP Deployment，等待新管理员密码生效，再运行 Helm 同步和 bootstrap。轮换 `LLDAP_AUTHELIA_PASSWORD` 时先手动部署 `lldap`，再部署 `authelia`。

## 卸载

普通卸载只删除 Helm release，保留工作流创建的 `lldap-secrets` 和 PostgreSQL 中的 `lldap` 数据库，重新安装可恢复用户和组。

完整清理需要显式执行三步：卸载 LLDAP、删除 `lldap-secrets`、连接 PostgreSQL 删除 `lldap` 数据库。LLDAP 没有独立 PVC；清理命令不会删除 PostgreSQL PVC，因为该 PVC 同时保存其他数据库。

## 验证

- `helm dependency build charts/lldap` 锁定上游 Chart `0.4.0`。
- `helm lint` 和 `helm template` 验证上游 Deployment/Service/Ingress 与 wrapper Hooks。
- 渲染结果必须关闭 HPA、PVC、cert-manager、LDAPS 和内置 Secret。
- 渲染结果必须使用官方镜像、外部 Secret、PostgreSQL URL 和 `ldap.acitrus.cn`。
- Authelia 渲染必须使用 `implementation: lldap`、内部地址和只读绑定 DN。
- 工作流测试必须确认 LLDAP 单组件路径、Secret 同步和轮换顺序。
- 最终差异不得包含真实密码或活动的 OpenDirectory 配置。

运行验收：管理员可打开 LLDAP UI，创建 `wfy`；`wfy` 可通过用户名或邮箱登录 Authelia；Pod 重启后目录数据仍存在；`authelia` 服务账号不能修改目录。
