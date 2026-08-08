# Claude Code Hub

该 Chart 参考 Claude Code Hub 官方 Kubernetes 清单维护，但只部署应用本体，复用集群中已有的
PostgreSQL 和 Redis。当前固定应用版本为 `v0.8.10`。

## 部署内容

- 一个无状态 `Deployment`
- 一个内部 `ClusterIP Service`
- 一个幂等的 PostgreSQL 数据库创建 Hook
- 官方 `/api/actions/health` 启动、就绪和存活探针
- 非 root、禁用 ServiceAccount Token、丢弃 Linux capabilities

该阶段不创建 Ingress、Authelia Middleware、PVC、PostgreSQL 或 Redis 实例。

## dev 环境

release 部署在 `app` 命名空间，连接：

```text
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / claude_code_hub / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 2
Service:    claude-code-hub.app.svc.cluster.local:80
```

应用启动时使用官方 `AUTO_MIGRATE=true` 执行 Drizzle migrations；Chart 的 pre-install、
pre-upgrade Hook 只负责在数据库不存在时创建 `claude_code_hub` 数据库。发布新应用版本前应先备份
该数据库；应用镜像版本固定在 values 中，不会自动跟随 `latest` 升级。

## Secret

GitHub `dev` Environment 需要新增：

- Secret `CCH_ADMIN_TOKEN`

部署流程复用已有的 `POSTGRES_PASSWORD` 和 `REDIS_PASSWORD`，生成
`app/claude-code-hub-secrets`：

```text
admin-token
dsn
redis-url
postgres-password
```

连接串中的密码会先做 URL 编码。真实值不会进入 Chart、values、Helm 参数或仓库。

## 渲染与部署

```bash
helm lint charts/claude-code-hub -f environments/dev/claude-code-hub/values.yaml
helm template claude-code-hub charts/claude-code-hub \
  --namespace app \
  -f environments/dev/claude-code-hub/values.yaml
helmfile -e dev --selector name=claude-code-hub sync
```

当前没有公网入口。入口域名、API 路由、Authelia 和自动登录桥将在基础服务验证稳定后单独接入。
