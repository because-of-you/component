快速启动日常使用的组件
目前支持

| 组件名称      | 支持多节点 | 备注                                       | 默认值 |
|-----------|-------|------------------------------------------|-----|
| zookeeper | 支持    | 通过修改环境变量`.env`文件zk副本数和compose中服务副本数控制    | 三节点 |
| kafka     | 支持    | 通过修改环境变量`.env`文件Kafka副本数和compose中服务副本数控制 | 三节点 |
| Hadoop    | 支持    | 通过修改环境变量`.env`文件环境变量控制（可能需要自定义）          | 三节点 |
| hive      | 不支持   | hive单独一个container依赖于mysql容器          |  |

## 参考文档
下载docker
https://www.51cto.com/article/715086.html


加速镜像
https://segmentfault.com/a/1190000022574084

启动方式在指定的目录下执行
```bash 
docker compose up
```

## 快速开始

进入`example`目录 每一个子目录代表一个日常用到的功能

```bash
git clone https://github.com/because-of-you/component.git
cd example/zk+kaf+hd+mysql+hive
docker compose up -d
```
