## 安装 bitnami
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```
## 运行 zookeeper
```bash
helm install zookeeper bitnami/zookeeper -f zookeeper/values.yaml
```

## 运行 kafka
```bash
helm install kafka bitnami/kafka -f kafka/values.yaml
```

