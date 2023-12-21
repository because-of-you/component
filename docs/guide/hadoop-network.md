---
lang: zh-CN
title: hadoop网络
description: hadoop 网络
---

## 说明

含有四个网络，如下表格：

| 文件名称                    | 说明                           |
|-------------------------|------------------------------|
| namenode-service        | 一个简单的namenode-service        |
| datanode-service        | 一个简单的datanode-service        |
| nodemanager-service     | 一个简单的nodemanager-service     |
| resourcemanager-service | 一个简单的resourcemanager-service |

## namenode-service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: namenode-service
  labels:
    app: namenode
spec:
  ports:
    - port: 9870
      name: namenode-web
      targetPort: 9870
      protocol: TCP

  clusterIP: None
  selector:
    app: namenode
```

## datanode-service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: datanode-service
  labels:
    app: datanode
spec:
  ports:
    - port: 9870
      name: datanode-web
      targetPort: 9870
      protocol: TCP

  clusterIP: None
  selector:
    app: datanode
```

## nodemanager-service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodemanager-service
  labels:
    app: nodemanager
spec:
  ports:
    - port: 9870
      name: nodemanager-web
      targetPort: 9870
      protocol: TCP

  clusterIP: None
  selector:
    app: nodemanager
```

## resourcemanager-service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: resourcemanager-service
  labels:
    app: resourcemanager
spec:
  ports:
    - port: 8088
      name: resourcemanager-web
      targetPort: 8088
      protocol: TCP

    - port: 19888
      name: resourcemanager-history-web
      targetPort: 19888
      protocol: TCP

  clusterIP: None
  selector:
    app: resourcemanager
```