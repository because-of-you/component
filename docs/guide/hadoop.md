---
lang: zh-CN
title: hadoop
description: hadoop 使用说明
---
[[toc]]

## 1.前置
在阅读本章节之前，希望你已经对`k8s`和`hadoop`具有一定的了解。
且能够在物理机或虚拟机熟练搭建。

## 2.结构说明
`hadoop`集群的k8s相关文件全部在github上，当然也可以根据章节来搭建。
```sh{4,7-10,13-16}
kubernetes/
├── configuration
│   └── configmap
│       └── hadoop-configmap.yaml
├── network
│   └── service
│       ├── datanode.yaml
│       ├── namenode.yaml
│       ├── nodemanager.yaml
│       └── resourcemanager.yaml
└── workloads
    └── statefulset
        ├── datanode.yaml
        ├── namenode.yaml
        ├── nodemanager.yaml
        └── resourcemanager.yaml
```
## 3.configuration
主要使用k8s的configmap对组件进行配置的编辑、映射。  
详情资料请参阅：[configMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)  
下一站资料请点击：[hadoop配置](./hadoop-configuration.md)

## 4.network
主要使用k8s相关网关，打通各个pod之间的网络通信问题。  
详情资料请参阅：[network](https://kubernetes.io/docs/concepts/services-networking/)  
下一站资料请点击：[hadoop网络](./hadoop-network.md)

## 5.workloads
主要使用k8s的 `statefulset` 完成pod的启动和持久卷。  
详情资料请参阅：[statefulset](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)   
下一站资料请点击：[hadoop statefulset 组件](./hadoop-statefulset.md)