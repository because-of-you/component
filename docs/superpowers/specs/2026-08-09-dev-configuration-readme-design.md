# dev 配置清单 README 设计

## 目标

把 GitHub `dev` Environment 所需的 Secrets 与 Variables 从单纯的名称列表整理成可直接执行的配置清单，让新增或重新部署组件时可以一次确认所需配置，不再通过失败日志逐项补齐。

## 文档分层

- 根 `README.md` 是唯一的配置入口，按组件分组列出配置名称、类型、用途、生成方式和依赖关系。
- 组件 README 保留详细的生成、轮换、Kubernetes Secret 映射和恢复说明。
- 根 README 链接到对应组件 README，不复制长篇运维步骤。

## 根 README 结构

在“dev 集群部署”中把现有扁平名称列表改为以下结构：

1. 公共连接配置：`KUBECONFIG`、Tailscale Variables。
2. 基础设施凭据：Redis、PostgreSQL、LLDAP、Traefik、ACR。
3. Authelia 与 OIDC：Authelia 自身密钥，以及 CCH/RustFS 的明文 Client Secret 与 PBKDF2 Digest 配对关系。
4. 应用凭据：Claude Code Hub 与 RustFS。

每项至少说明：

- GitHub 配置名称；
- `Secret` 或 `Variable`；
- 哪个组件或工作流使用；
- 是否可以随机生成、需要保留完整文件内容，或必须与另一项由同一次命令生成；
- 对应的详细组件 README。

## RustFS 当前契约

RustFS 分组明确列出：

- `RUSTFS_ACCESS_KEY`；
- `RUSTFS_SECRET_KEY`；
- `RUSTFS_OIDC_CLIENT_SECRET`；
- `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`。

OIDC 两项必须由同一次 Authelia CLI 命令生成：`Random Password` 保存为明文 Client Secret，`Digest` 保存为 PBKDF2 摘要。根 README 提供可复制的生成命令，并说明配置位置为 GitHub `dev` Environment Secrets。

## 维护约定

以后新增组件或工作流配置时，必须同时更新：

- 根 README 的统一配置清单；
- 对应组件 README 的详细说明；
- 组件渲染测试中的文档断言，确保工作流引用的配置不会只存在于代码中而遗漏文档。

真实凭据、私钥和摘要不得写入 README、values 或测试夹具。

## 验证

- 从工作流提取 `secrets.*` 与 `vars.*`，确认根 README 全部覆盖。
- RustFS 测试验证四个配置名称、OIDC 配对说明和生成命令入口。
- 执行相关 render tests、Markdown/UTF-8 检查、敏感值扫描和 `git diff --check`。
