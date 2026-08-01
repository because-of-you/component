# Authelia Traefik LDAP Chart 设计

## 目标

新增一个名为 `authelia` 的 Helm Wrapper Chart，将 Authelia 部署到 `infra` 命名空间，并通过现有 Traefik 以 `https://auth.acitrus.cn` 对外提供登录门户。

Authelia 使用 OpenLDAP 作为第一认证因子。第一版只要求 LDAP 用户名和密码，不启用 TOTP、WebAuthn 或其他第二认证因子。

## Chart 结构

Wrapper Chart 固定依赖 Authelia 官方 Helm Chart `0.11.6`，对应 Authelia `4.39.20`。官方 Chart 负责 Deployment、Service、ConfigMap 和 PVC 等标准工作负载，本地 `charts/authelia/templates/` 负责仓库需要明确控制的资源：

- 包含用户提供密钥值的 Kubernetes Secret。
- 暴露登录门户的 Traefik `IngressRoute`。
- 供其他服务引用的 Traefik `ForwardAuth` Middleware。

在 `helmfile.yaml` 中注册 `authelia` release，并分别提供 dev/prod 环境 values 文件。

## LDAP 配置

LDAP 连接使用以下固定默认值：

```text
address: ldap://opendirectory.net
base_dn: dc=acitrus,dc=opendirectory,dc=net
additional_users_dn: ou=public
bind_dn: cn=acitrus,ou=admins,dc=opendirectory,dc=net
username attribute: uid
```

用户查询采用适用于 OpenLDAP 的自定义过滤器：

```text
(&({username_attribute}={input})(objectClass=person))
```

组查询采用 RFC2307 的 `posixGroup.memberUid` 模型：

```text
(&(memberUid={username})(objectClass=posixGroup))
```

组名属性使用 `cn`。如果目录中没有匹配的 `posixGroup`，用户认证本身仍由用户查询和密码绑定完成，组列表为空。

第一版按用户提供的地址使用未加密 LDAP。地址、过滤器和属性映射仍保留为 values，以便后续切换到 LDAPS、StartTLS 或不同目录结构。

## 认证和会话

默认访问策略为 `one_factor`，即所有受 ForwardAuth Middleware 保护的请求都需要通过 LDAP 用户名和密码认证。

会话 Cookie 的根域为 `acitrus.cn`，Authelia 门户 URL 为 `https://auth.acitrus.cn`。第一版使用 Authelia 内存会话存储，适配单副本部署。

密码修改和密码重置入口默认关闭，避免第一版依赖邮件通知和 LDAP 写权限。Authelia 必需的通知器使用 filesystem 实现。

## 存储

第一版使用本地 SQLite 存储，并启用单副本 PVC。PVC 用于保存 SQLite 数据库和 filesystem notifier 文件，避免 Pod 重建后丢失状态。

本地存储不支持多副本，因此默认副本数固定为 1。后续如需高可用，应单独迁移到 PostgreSQL 和 Redis，不在本次范围内。

## 密钥配置

仓库默认 values 只定义空字段，不包含真实密钥：

```yaml
autheliaSecrets:
  enabled: false
  ldapPassword: ""
  sessionEncryptionKey: ""
  storageEncryptionKey: ""
  resetPasswordJwtSecret: ""
```

用户在自己的环境 values 文件中填写明文值，并将 `enabled` 设为 `true`。本地 Secret 模板通过 `stringData` 生成 Kubernetes Secret。启用模板时，每个必要字段都使用 Helm `required` 校验，阻止空密钥被部署。

Authelia 官方子 Chart 和本地模板都从 `authelia.secret.existingSecret` 读取 Secret 名称，避免覆盖名称时两者失配。默认 values、dev values 和 prod values 均不包含用户提供的真实密码。

## Traefik 资源

登录门户使用本地 `IngressRoute`：

- Host 为 `auth.acitrus.cn`。
- EntryPoint 为 `websecure`。
- TLS 使用现有 Traefik `leresolver`。
- 后端为同一命名空间中的 Authelia Service，默认端口为 80。

本地 `ForwardAuth` Middleware 请求 Authelia 的 `/api/authz/forward-auth` 端点，并信任 Traefik 传递的代理头。认证成功后向后端传递以下身份 Header：

```text
Remote-User
Remote-Name
Remote-Email
Remote-Groups
```

其他 `IngressRoute` 可以通过同命名空间引用，或在 Traefik 已开启跨命名空间引用的前提下使用带 namespace 的 Middleware 引用。

Authelia 门户自身的 `IngressRoute` 不挂载 ForwardAuth Middleware，避免登录循环。

## Values 边界

Wrapper Chart 顶层 values 包含三类配置：

- `authelia`：传给官方子 Chart 的配置，包括 LDAP、session、storage、notifier、persistence 和 workload 设置。
- `autheliaSecrets`：本地 Secret 模板使用的明文密钥值。
- `autheliaIngress` 与 `autheliaForwardAuth`：本地 Traefik CRD 的域名、入口点、TLS、Service 和 Middleware 参数。

所有固定默认值都可覆盖，但环境 values 只保存环境差异和用户自行填写的密钥。

## 失败和安全行为

- Secret 模板启用但缺少必要值时，Helm 渲染失败。
- LDAP 无法连接、Bind 失败或用户密码错误时，Authelia 不创建认证会话。
- ForwardAuth 无法访问 Authelia 时，Traefik 不把请求放行到受保护后端。
- IngressRoute 只暴露 HTTPS 入口。
- 未加密 LDAP 会在网络上传输 Bind 和登录凭据，这是当前内网部署设计的已知限制。

## 验证

实现完成后执行以下验证：

- `helm dependency update charts/authelia` 锁定并下载官方依赖。
- `helm lint charts/authelia` 验证默认关闭 Secret 模板时 Chart 合法。
- 使用测试 values 执行 `helm template`，验证 Secret、IngressRoute、Middleware、LDAP 配置、PVC 和官方工作负载。
- 验证启用 Secret 但缺少字段时渲染明确失败。
- 使用非真实占位密钥分别执行 dev/prod Helmfile 渲染。
- 扫描工作区，确认用户提供的真实 LDAP 密码没有写入仓库文件。
