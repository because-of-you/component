# DBX

这个 Chart 使用 DBX 官方容器镜像部署单实例 DBX Web。DBX 当前没有发布官方 Helm Chart，因此本仓库维护
Deployment、ClusterIP Service、PVC 和可选的 Traefik IngressRoute；如果上游以后发布官方 Chart，可以将
本 Chart 改为 wrapper dependency，同时保留环境 values 和 Authelia 集成。

## 默认行为

- 官方镜像：`t8y2/dbx:0.5.87`
- 单副本 `Deployment`，更新策略为 `Recreate`
- `ClusterIP` Service，容器端口 `4224`
- `/app/data` 使用 `ReadWriteOnce` PVC 持久化
- NetworkPolicy 默认关闭，dev 中只允许 `traefik` 命名空间访问 Web 端口
- IngressRoute 默认关闭
- DBX 自身密码默认保留，避免独立安装时意外暴露无认证实例

DBX 将连接配置、查询历史和其他应用状态写入 `/app/data/dbx.db`。升级或卸载前应备份 PVC；不要让多个
Pod 同时挂载并写入同一数据目录。

## dev 环境

dev 使用固定版本的 DBX 官方镜像、域名 `https://db.acitrus.cn`，并将整个 IngressRoute 挂载到
`infra/authelia-forwardauth`。由于入口已经由 Authelia 保护，dev 设置：

```yaml
config:
  disablePassword: true
```

这会向容器传入 `DBX_DISABLE_PASSWORD=1`，避免 Authelia 登录后再次出现 DBX 密码页。不得为 `/api`、静态资源
或认证路径创建绕过 ForwardAuth 的第二条公网路由。Service 必须保持 `ClusterIP`。

dev 同时启用 NetworkPolicy，仅允许 `traefik` 命名空间访问 DBX Web 端口，避免集群内其他 Pod 通过 ClusterIP
绕过 Authelia。该策略不限制 DBX 的出站数据库连接。

当前 Authelia 规则只允许 LLDAP `lldap_admin` 组访问。Authelia 只负责入口授权；DBX 不会依据
`Remote-User` 或 `Remote-Groups` 提供多用户 RBAC。需要保证数据库只读时，必须让 DBX 使用数据库原生只读账号。

## 渲染与部署

```bash
helm lint charts/dbx -f environments/dev/dbx/values.yaml
helm template dbx charts/dbx --namespace app -f environments/dev/dbx/values.yaml
helmfile -e dev template --selector name=dbx --skip-deps
helmfile -e dev apply --selector name=dbx
```

独立 OCI 安装时必须显式决定使用 DBX 密码还是可信的外部认证代理。例如启用 Authelia 时：

```bash
helm upgrade --install dbx oci://ghcr.io/because-of-you/charts/dbx \
  --version 0.0.0-dev \
  --namespace app \
  --create-namespace \
  -f values.yaml
```
