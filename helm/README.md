# Kafka 部署系统说明

本项目使用 Bitnami 的 Kafka Helm Chart 来部署 Kafka 组件，通过 GitHub Issue 模板实现自动化部署流程。

## 部署流程

1. 在 GitHub 上创建新的 Issue，选择 "Kafka 组件部署请求" 模板
2. 填写部署信息（部署名称、副本数量、存储空间等）
3. 确认提供的 `sample.yaml` 配置是否符合需求
4. 系统将自动创建包含配置文件的分支，并生成 Helm 部署命令
5. 在确认后，系统将提供最终的部署命令供执行
6. 关闭 Issue 时，相关配置文件将被自动删除

## 配置说明

配置文件使用 Bitnami Kafka Helm Chart 的格式，主要配置项包括：

- `replicaCount`: Kafka 副本数量
- `persistence`: 持久化存储配置
- `resources`: CPU 和内存资源限制
- `zookeeper`: ZooKeeper 配置（可使用内置或外部 ZooKeeper）
- `configuration`: Kafka 服务配置参数
- `affinity`: Pod 亲和性配置

## 示例配置

示例配置文件位于 `helm/configs/kafka/example-values.yaml`，可作为参考。

## Helm 命令格式

系统生成的 Helm 命令格式如下：

```bash
helm upgrade --install <部署名称> bitnami/kafka -f <配置文件URL>
```

## 注意事项

1. 执行部署命令前，请确保已安装 Helm 并配置了正确的 Kubernetes 集群访问权限
2. 如需使用外部 ZooKeeper，可在配置文件中设置 `zookeeper.enabled: false` 并提供连接信息
3. 配置文件保存在 `helm/configs/kafka/<issue编号>/values.yaml`
4. 相关配置文件会在 Issue 关闭时自动从代码库中删除