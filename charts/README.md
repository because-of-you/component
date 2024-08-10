## 安装 bitnami
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add conduktor-component https://helm.conduktor.io
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

## pg
```bash
helm install postgresql bitnami/postgresql -f postgresql/values.yaml 
```

## conduktor
```bash

```
