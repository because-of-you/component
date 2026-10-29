# CCH Plus

该 Chart 按 [CCH Plus Kubernetes 安装文档](https://cch-plus.com/zh-CN/docs/installation/kubernetes)
将官方 11 个清单模板化，并适配本仓库现有的 Helmfile 与 Traefik。它是独立于旧版
`claude-code-hub` 的系统，默认部署在 `cchp` namespace。

## 部署内容

- `control` Deployment、`gateway` StatefulSet、`worker` Deployment
- `cch-plus-migrate-<revision>` 数据库迁移 Job（首次安装普通运行，后续 Helm 升级使用
  `pre-upgrade` Hook）
- TimescaleDB PostgreSQL 18 和 Dragonfly 独立 StatefulSet
- `cchp-objectstore`、`cchp-task-results` 和各工作负载的临时卷
- Traefik `IngressRoute`：API、控制台和 CC Hub 导入上传入口

镜像默认使用 `ghcr.io/cch-hq/cch-plus:1.0.13`。dev 环境将官方镜像同步为
`registry.cn-shenzhen.aliyuncs.com/gravitation/cch-plus:dev-1.0.13`，并通过 Helmfile 的
`--set image.tag=dev-1.0.13` 固定部署版本。升级时应同时更新镜像清单、环境 values 和工作流
中的版本，避免重新使用浮动标签。

TimescaleDB 和 Dragonfly 也会同步到 ACR，dev values 分别使用
`gravitation/timescaledb:2.31.0-pg18` 和 `gravitation/dragonfly:v2.0.2`，避免 Pod 启动时
直接从境外仓库拉取。

## Secret

默认不由 Chart 创建 Secret，部署工作流应在 Helm 同步前创建以下资源：

`cchp-migration-secrets`：

- `POSTGRES_PASSWORD`
- `ATLAS_DATABASE_URL`
- `CCHP_DATABASE_RUNTIME_PASSWORD`

当前 dev 工作流将已有 GitHub Environment Secret `POSTGRES_PASSWORD` 复用为 cch-plus
专用 TimescaleDB 的管理员密码；cch-plus 仍使用独立数据库和 PVC，不会连接旧版数据库。

`cchp-secrets`：

- `DATABASE_URL`
- `DRAGONFLY_URL`
- `CCH_TOKEN_PEPPER`
- `CCH_MASTER_KEY`
- `DRAGONFLY_KEY_SECRET`

若仅用于本地测试，可设置 `secrets.create=true` 并通过临时 values 提供这些值；真实密钥
不得提交到仓库。

## Traefik

官方清单使用 ingress-nginx。本 Chart 使用现有 Traefik `IngressRoute`，因此不需要关闭
K3s Traefik 或额外安装 ingress-nginx。API 域名将 `/v`、`/v1`、`/v1beta`、`/v4` 和
`/ws` 转发到 gateway，控制台域名转发到 control，上传路径
`/api/admin/cchub-import/upload` 单独转发到 control。

dev 使用 `https://cchp.acitrus.cn` 作为控制台地址、`https://api.cchp.acitrus.cn` 作为 API
地址；部署前需确保两个 DNS 记录指向 Traefik。官方清单估算持久化与临时卷合计约 481Gi，
请先确认 K3s 节点磁盘容量。

## 渲染

```bash
helm lint charts/cch-plus
helm template cch-plus charts/cch-plus \
  --namespace cchp \
  -f environments/dev/cch-plus/values.yaml
helmfile -e dev --selector name=cch-plus sync
```

TimescaleDB、Dragonfly、数据库迁移和 cch-plus 应用使用独立存储和连接信息，不能指向旧
`claude-code-hub` 的数据库或 Redis。

官方迁移只向前执行；升级前请先备份 `cchp` PostgreSQL。不要把新旧版本指向同一数据库，
也不要把 Helm 回滚当作数据库回滚方案。

当前默认 requests 已按低流量单节点场景下调，limits 保留较宽余量；如节点压力仍高，可继续
覆盖 `postgres.resources`、`dragonfly.resources` 和 `workloads.*.resources`，不要降低 PVC
容量来解决 CPU/内存压力。
