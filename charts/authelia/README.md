# Authelia

这个 Chart 封装 Authelia 官方 Helm Chart，使用 LDAP 完成一次认证，并创建 `auth.acitrus.cn` 的 Traefik IngressRoute 与可复用 ForwardAuth Middleware。

官方依赖固定为 Chart `0.11.6`、Authelia `4.39.20`。默认 LDAP 配置为：

```text
ldap://opendirectory.net
dc=acitrus,dc=opendirectory,dc=net
ou=public
uid
```

用户通过 `uid` 登录，组查询使用 RFC2307 `posixGroup.memberUid`。当前 LDAP 连接未加密，只适合用户确认的内网部署环境。

## 填写密钥

部署前在对应环境的 `authelia/values.yaml` 中填写：

```yaml
autheliaSecrets:
  enabled: true
  ldapPassword: "example-only-ldap-password"
  sessionEncryptionKey: "example-only-session-key-at-least-32-characters"
  storageEncryptionKey: "example-only-storage-key-at-least-20-characters"
  resetPasswordJwtSecret: "example-only-reset-key-at-least-32-characters"
```

不要把包含真实密钥的环境 values 提交到公共仓库。

- `ldapPassword`：LDAP Bind DN 的密码。
- `sessionEncryptionKey`：会话加密密钥，至少 32 个字符。
- `storageEncryptionKey`：Authelia 存储加密密钥，至少 20 个字符。
- `resetPasswordJwtSecret`：密码重置 JWT 签名密钥；当前虽关闭密码重置，Authelia 配置仍保留该必需密钥。

## 渲染与部署

```bash
helm dependency update charts/authelia
helmfile -e dev template --selector name=authelia --skip-deps
helmfile -e dev apply --selector name=authelia
```

通过 OCI 安装时，把相同字段写入自己的 `values.yaml`：

```bash
helm upgrade --install authelia oci://ghcr.io/because-of-you/charts/authelia \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

## 保护其他 IngressRoute

Traefik 已允许跨命名空间引用时，在目标路由中加入：

```yaml
middlewares:
  - name: authelia-forwardauth
    namespace: infra
```

ForwardAuth 成功后会传递 `Remote-User`、`Remote-Name`、`Remote-Email` 和 `Remote-Groups`。

## 存储限制

默认使用 SQLite、filesystem notifier 和单副本 StatefulSet，数据保存在 1Gi PVC 中。该模式不支持多副本；需要高可用时应迁移到 PostgreSQL 和 Redis。
