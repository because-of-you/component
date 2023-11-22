---
lang: zh-CN
title: yarn配置
description: yarn配置 | 基于kubernetes的本地个性化开发集群
---

[[toc]]

## 默认配置参数

`resourcemanager` 容器默认3GB内存，堆内存1800MB。  
`nodemanager` 容器默认2GB内存，堆内存1000MB。(问就是资源少的可怜，能跑就行不要求自行车)

## 运行时配置

| 参数名称                                 | 预设值 | 备注                                                                      |
|--------------------------------------|-----|-------------------------------------------------------------------------|
| mapreduce.map.memory.mb              | 256 | 一个Map Task可使用的资源上限（单位:MB），默认为1024。如果MapTask实际使用的资源量超过该值，则会被强制杀死。        |
| mapreduce.reduce.memory.mb           | 512 | 一个Reduce Task可使用的资源上限（单位:MB），默认为1024。如果Reduce Task实际使用的资源量超过该值，则会被强制杀死。 |
| mapreduce.reduce.memory.mb           | 512 | 一个Reduce Task可使用的资源上限（单位:MB），默认为1024。如果Reduce Task实际使用的资源量超过该值，则会被强制杀死。 |
| yarn.scheduler.minimum-allocation-mb | 256 | 给应用程序container分配的最小内存                                                   |
| yarn.scheduler.maximum-allocation-mb | 768 | 给应用程序container分配的最大内存                                                   |
| yarn.app.mapreduce.am.resource.mb    | 768 | MR运行于YARN上时，为AM分配多少内存                                                   |
| yarn.nodemanager.resource.memory-mb  | 768 | 节点可用内存                                                                  |

配置未必合理｜请自由调整

## 参考

https://developer.aliyun.com/article/5911
