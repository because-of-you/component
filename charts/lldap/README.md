# LLDAP

这个 wrapper 使用 LLDAP 官方安装文档推荐的 Helm 仓库：

```text
repository: https://evantage-ws.github.io/lldap-kubernetes/
chart: lldap
version: 0.4.0
```

上游 Chart 负责 Deployment、Service、Ingress、探针和标准 Kubernetes 资源。本仓库通过 values
切换到官方 `lldap/lldap:stable-alpine-rootless` 镜像，关闭 HPA、PVC、cert-manager 和 LDAPS，
并追加 PostgreSQL 建库及 Authelia 只读账号 bootstrap Hooks。

## dev 配置

```text
Web:       https://ldap.acitrus.cn
LDAP:      ldap://lldap.infra.svc.cluster.local:3890
Base DN:   dc=acitrus,dc=cn
Database:  postgresql.infra.svc.cluster.local:5432/lldap
Admin:     admin
Bind DN:   uid=authelia,ou=people,dc=acitrus,dc=cn
Bind group: lldap_strict_readonly
```

LDAP 端口只通过 ClusterIP 提供，不创建公网 TCP 路由。Web UI 通过 Traefik `websecure` 和
`leresolver` 提供 HTTPS。

## GitHub Secrets

在 GitHub `dev` Environment 中新增：

- `LLDAP_JWT_SECRET`
- `LLDAP_KEY_SEED`
- `LLDAP_ADMIN_PASSWORD`
- `LLDAP_AUTHELIA_PASSWORD`

LLDAP 还复用已有 `POSTGRES_PASSWORD`。可以分别生成随机值，例如：

```bash
openssl rand -base64 48  # LLDAP_JWT_SECRET
openssl rand -base64 32  # LLDAP_KEY_SEED
openssl rand -base64 32  # LLDAP_ADMIN_PASSWORD
openssl rand -base64 32  # LLDAP_AUTHELIA_PASSWORD
```

不要把生成结果写入 values 或仓库。部署工作流会创建 `infra/lldap-secrets`，键名符合上游 Chart：

```text
lldap-jwt-secret
lldap-key-seed
lldap-ldap-user-name
lldap-ldap-user-pass
base-dn
database-url
authelia-password
```

PostgreSQL 密码会先进行 URL 编码，再写入 `database-url`。

## 渲染和部署

```bash
helm dependency build charts/lldap
helm lint charts/lldap -f environments/dev/lldap/values.yaml
helmfile -e dev template --selector name=lldap --skip-deps
helmfile -e dev sync --selector name=lldap
```

首次安装时，pre-install Hook 幂等创建 `lldap` 数据库。LLDAP 就绪后，post-install Hook 调用官方
`/app/bootstrap.sh` 创建 `authelia` 用户并加入 `lldap_strict_readonly`。重复部署会更新声明状态，
但 `DO_CLEANUP=false`，不会删除手工创建的用户或组。

## 首次使用

1. 打开 `https://ldap.acitrus.cn`。
2. 使用用户名 `admin` 和 GitHub Secret `LLDAP_ADMIN_PASSWORD` 登录。
3. 创建用户名 `wfy`，填写邮箱和显示名称，并设置一个未在其他服务使用的新密码。
4. 按需把 `wfy` 加入业务组。
5. 在 `https://auth.acitrus.cn` 使用 `wfy` 或邮箱登录。

`ldap.acitrus.cn` 的 Traefik Ingress 引用了 `infra/authelia-forwardauth` Middleware。只有属于
`lldap_admin` 组的用户可以访问管理页面；集群内部 LDAP Service 和 bootstrap Job 不经过该入口。

LLDAP 不需要指定 SSHA、SHA256 等算法；通过 Web UI 设置明文密码后，服务端自行安全存储并通过
LDAP Bind 验证。

## 日志与排查

查看当前 Pod 的全部日志：

```bash
kubectl -n infra logs deployment/lldap --all-containers=true --tail=-1
kubectl -n infra logs -f deployment/lldap --all-containers=true
```

Hook 失败时会保留 Job，分别查看：

```bash
kubectl -n infra logs job/lldap-database
kubectl -n infra logs job/lldap-bootstrap
```

验证服务和 Secret 引用：

```bash
kubectl -n infra get deploy,svc,ingress,job -l app.kubernetes.io/instance=lldap
kubectl -n infra describe deployment lldap
```

## 密码轮换

轮换 `LLDAP_AUTHELIA_PASSWORD` 后，依次在 GitHub Actions 手动部署：

1. `lldap`：更新 Secret、重启 LLDAP、bootstrap 新密码。
2. `authelia`：把同一个新密码同步到 `authelia-secrets`。

轮换管理员密码、JWT secret、key seed 或 PostgreSQL 密码时也应先部署 LLDAP。注意：只更新
`POSTGRES_PASSWORD` Secret 不会修改 PostgreSQL 数据库内部密码，必须先完成数据库密码变更。

## 卸载与完整清理

普通卸载保留 Secret 和 PostgreSQL 数据库，重新安装后目录数据仍在：

```bash
helm uninstall lldap -n infra
```

完整清理先卸载并删除 LLDAP Secret：

```bash
helm uninstall lldap -n infra --ignore-not-found
kubectl -n infra delete secret lldap-secrets --ignore-not-found
```

然后使用一次性 PostgreSQL Pod 删除数据库；密码通过 Secret 引用，不出现在命令行：

```bash
kubectl -n infra run lldap-drop-database --rm -i --restart=Never \
  --image=postgres:18.4-alpine \
  --overrides='{"spec":{"containers":[{"name":"lldap-drop-database","image":"postgres:18.4-alpine","env":[{"name":"PGPASSWORD","valueFrom":{"secretKeyRef":{"name":"postgresql-auth","key":"postgres-password"}}}],"command":["psql"],"args":["-h","postgresql.infra.svc.cluster.local","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c","DROP DATABASE IF EXISTS lldap WITH (FORCE);"]}]}}'
```

LLDAP 没有独立 PVC。不要为清理 LLDAP 删除 PostgreSQL PVC；该 PVC 同时保存 Authelia 和其他
PostgreSQL 数据库。
