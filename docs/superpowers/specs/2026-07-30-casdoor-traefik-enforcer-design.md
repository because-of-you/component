# Casdoor Traefik Enforcer 设计

## 目标

在不新增 Kubernetes Deployment 或 Service 的前提下，用 Casdoor 作为唯一权限策略源保护 Traefik 后面的 HTTP 服务。

每个已认证请求都必须调用 Casdoor `/api/enforce`。只有 Casdoor 明确返回允许时才转发到后端；无匹配策略、明确拒绝、身份缺失或 Casdoor 不可用都不放行。

## 架构

使用两个运行在现有 Traefik Pod 内的 Middleware Plugin，并通过 Traefik `chain` 组合：

1. 社区 `traefikoidc` 插件负责 Casdoor OIDC 登录、会话和 Token 校验。
2. 仓库内置的 `casdoorEnforcer` 本地插件负责把请求映射为 Casbin 参数并调用 Casdoor Enforce API。

插件源码通过 ConfigMap 挂载到 Traefik 的 `/plugins-local`，不创建额外工作负载。

## 请求映射

OIDC Middleware 从已经验证的 Casdoor Token 中读取 `owner` 和 `name`，覆盖写入：

```text
X-Casdoor-Subject: <owner>/<name>
```

Enforcer 为每个请求生成：

```text
sub = X-Casdoor-Subject
obj = strings.ToLower(request.Host) + request.URL.EscapedPath()
act = strings.ToUpper(request.Method)
```

查询参数不进入 `obj`。例如：

```json
[
  "built-in/alice",
  "api.acitrus.cn/api/users/123",
  "POST"
]
```

## Casdoor 调用

Enforcer 调用：

```text
POST <endpoint>/api/enforce?permissionId=<permissionId>
Authorization: Basic <RFC 7617 client-id:client-secret>
Content-Type: application/json
```

请求体是 `[sub, obj, act]`。应用 Client Secret 来自 Kubernetes Secret 注入的环境变量，不写入 Middleware CRD。

## 判定和失败策略

- `status=ok` 且 `data` 至少包含一个 `true`：继续转发。
- `status=ok` 但没有任何 `true`：返回 `403 Forbidden`。
- 缺少可信用户标识：返回 `401 Unauthorized`。
- Casdoor 超时、非预期 HTTP 状态、无效 JSON 或 `status!=ok`：返回 `503 Service Unavailable`。
- 第一版不缓存授权结果，Casdoor 权限修改对下一次请求立即生效。

## Helm 配置

Traefik Wrapper Chart 提供：

- Casdoor Enforcer 本地插件源码 ConfigMap。
- OIDC、Enforcer 和 Chain 三个 Middleware。
- OIDC 社区插件和本地插件静态注册。
- Client Secret 的可选 Secret 环境变量引用。

功能默认关闭，避免缺少 Casdoor 配置时影响现有 Traefik。启用时必须配置 Casdoor Endpoint、Client ID 和 Permission ID，并在 Traefik 命名空间提供固定名称 `casdoor-traefik-auth` 的 Secret。

## 安全边界

- Enforcer 只能放在 OIDC Middleware 之后。
- OIDC Middleware 必须覆盖 `X-Casdoor-Subject`，不能信任客户端传入的同名 Header。
- Casdoor Client Secret 不出现在 Helm 渲染后的 Middleware。
- 授权服务异常时 fail closed。
- 后端只在 Casdoor 明确允许后收到请求。

## 验证

- Go 单元测试覆盖允许、拒绝、身份缺失、上游异常、超时、请求映射和 Basic Auth。
- `helm lint` 验证 Wrapper Chart。
- `helm template` 验证 ConfigMap、插件静态配置、Secret 引用和 Middleware Chain。
- `helmfile` 验证 dev/prod 现有环境仍能渲染。
