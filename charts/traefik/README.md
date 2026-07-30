# traefik

这个 Chart 是对官方 Traefik Helm Chart 的本地封装，用来维护本仓库自己的默认配置。

## OCI 使用方式

dev 分支构建会发布到 GHCR 的 OCI Helm Registry：

```bash
helm registry login ghcr.io

helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace
```

如果需要覆盖默认配置，可以传入自己的 values 文件：

```bash
helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace \
  -f values.yaml
```

## Values 结构

因为官方 Traefik Chart 是当前 Chart 的依赖，所以传给上游 Traefik 的配置必须放在 `traefik:` 下面：

```yaml
traefik:
  deployment:
    replicas: 2
  service:
    type: LoadBalancer
```

Chart 默认配置在：

```text
charts/traefik/values.yaml
```

本仓库本地调试和部署用的环境覆盖配置在：

```text
environments/dev/traefik/values.yaml
environments/prod/traefik/values.yaml
```

这些环境配置不会被打包进 OCI Chart，只会在本仓库通过 Helmfile 渲染或部署时使用。

## Aliyun DNS Secret

当前 Chart 提供了一个可选的 Aliyun DNS Secret 模板，用于 Traefik ACME DNS Challenge。

默认不会创建 Secret：

```yaml
aliyunSecret:
  enabled: false
  name: alidns
  accessKey: ""
  secretKey: ""
```

如果需要让 Chart 创建 Secret，可以在自己的 values 中启用：

```yaml
aliyunSecret:
  enabled: true
  name: alidns
  accessKey: "<ALICLOUD_ACCESS_KEY>"
  secretKey: "<ALICLOUD_SECRET_KEY>"
```

Traefik 会通过 `envFrom` 引用这个 Secret：

```yaml
traefik:
  envFrom:
    - secretRef:
        name: alidns
```

然后在 ACME DNS Challenge 中使用 `alidns` provider：

```yaml
traefik:
  certificatesResolvers:
    leresolver:
      acme:
        storage: /data/acme.json
        email: "mail@example.com"
        dnsChallenge:
          provider: alidns
          delayBeforeCheck: 0
```

使用 OCI 安装时，可以直接通过环境变量和 `--set-string` 传入：

```bash
export ALICLOUD_ACCESS_KEY="xxx"
export ALICLOUD_SECRET_KEY="xxx"
```

```bash
helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace \
  --set aliyunSecret.enabled=true \
  --set aliyunSecret.name=alidns \
  --set-string aliyunSecret.accessKey="$ALICLOUD_ACCESS_KEY" \
  --set-string aliyunSecret.secretKey="$ALICLOUD_SECRET_KEY"
```

不要把真实的 `accessKey` 和 `secretKey` 提交到 Git 仓库。生产环境也可以使用 External Secrets、Sealed Secrets、SOPS，或者在集群中提前创建同名 Secret，并保持 `aliyunSecret.enabled=false`。

## 使用 Casdoor 统一授权

这个 Chart 内置了一个运行在 Traefik Pod 内的 `casdoorEnforcer` 插件。它和 OIDC Middleware 组成下面的调用链，不会新增 Deployment 或 Service：

```text
casdoor-oidc -> casdoor-enforcer -> backend
```

OIDC Middleware 负责登录和 Token 校验，Enforcer 把每个请求转换成 Casdoor Casbin 参数：

```text
sub = <Casdoor owner>/<Casdoor username>
obj = <小写 Host><URL Path>
act = <大写 HTTP Method>
```

例如：

```json
["built-in/alice", "api.acitrus.cn/api/users/123", "POST"]
```

每个请求都会调用：

```text
POST /api/enforce?permissionId=<permissionId>
```

只有 Casdoor 明确返回 `true` 才会转发到后端。无匹配 Policy 返回 `403`；Casdoor 超时或异常返回 `503`。查询参数不会参与权限匹配。

### 1. 创建凭据 Secret

Client Secret 和会话加密密钥不写入 values，提前创建固定名称的 Secret：

```bash
kubectl -n traefik create secret generic casdoor-traefik-auth \
  --from-literal=client-secret='<CASDOOR_CLIENT_SECRET>' \
  --from-literal=session-encryption-key="$(openssl rand -hex 32)"
```

如果 Secret 已经存在，使用 External Secrets、Sealed Secrets 或其他 Secret 管理工具更新，不要把明文提交到仓库。

### 2. 启用 Middleware

创建一个覆盖文件，例如 `casdoor-auth-values.yaml`：

```yaml
casdoorAuthorization:
  enabled: true
  providerURL: https://casdoor.acitrus.cn
  enforceEndpoint: http://casdoor.infra.svc.cluster.local:8000
  clientID: <CASDOOR_CLIENT_ID>
  permissionID: built-in/api-gateway
  oidc:
    callbackURL: /oauth2/callback
    logoutURL: /oauth2/logout
    cookieDomain: .acitrus.cn
```

安装或升级：

```bash
helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace \
  -f casdoor-auth-values.yaml
```

Casdoor Application 的 Redirect URLs 需要包含每个受保护域名的 callback，例如：

```text
https://traefik.acitrus.cn/oauth2/callback
https://api.acitrus.cn/oauth2/callback
```

本地插件源码更新后，升级 Chart 并重启 Traefik Pod，使 Traefik 重新加载插件：

```bash
kubectl -n traefik rollout restart deployment/traefik
kubectl -n traefik rollout status deployment/traefik
```

### 3. 保护后端路由

在需要保护的 `IngressRoute` 上引用 Chain Middleware：

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: backend
  namespace: backend
spec:
  entryPoints:
    - websecure
  routes:
    - kind: Rule
      match: Host(`api.acitrus.cn`)
      middlewares:
        - name: casdoor-protected
          namespace: traefik
      services:
        - name: backend
          port: 8080
```

保护 Traefik Dashboard 时，在当前 Chart 的 Dashboard 路由上绑定同一个 Middleware：

```yaml
traefik:
  ingressRoute:
    dashboard:
      middlewares:
        - name: casdoor-protected
          namespace: traefik
```

### 4. 在 Casdoor 配置权限

Casbin Model 使用 `sub`、`obj`、`act` 三元组，并通过角色关系匹配用户：

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act)
```

示例策略：

```text
# admin 可以修改用户
p, <org>/role-admin, api.acitrus.cn/api/users/*, POST|PUT|DELETE

# viewer 可以读取用户
p, <org>/role-viewer, api.acitrus.cn/api/users/*, GET

# 用户与角色的关系
g, <org>/alice, <org>/role-admin
g, <org>/bob, <org>/role-viewer
```

实际的组织名、角色名、资源和动作都在 Casdoor 的 Role、Permission、Model 与 Policy 页面维护。Traefik 配置中不写业务角色或接口路径。

## 本地调试

首次克隆仓库，或者修改 `Chart.yaml` 里的依赖后，先更新依赖：

```bash
helm dependency update charts/traefik
```

只使用 Chart 默认 values 渲染：

```bash
helm template traefik charts/traefik --namespace traefik
```

使用 dev 环境覆盖配置渲染：

```bash
helmfile -e dev template --selector name=traefik --skip-deps
```

使用 prod 环境覆盖配置渲染：

```bash
helmfile -e prod template --selector name=traefik --skip-deps
```

部署到当前 kubeconfig 指向的集群：

```bash
helmfile -e dev apply --selector name=traefik
helmfile -e prod apply --selector name=traefik
```

`--skip-deps` 适合本地快速调试，前提是依赖已经下载过。CI 或依赖版本变更后不要加这个参数。
