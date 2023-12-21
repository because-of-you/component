---
lang: zh-CN
title: hadoop配置
description: hadoop 配置说明
---

[[toc]]

## 说明

含有五个配置文件，如下表格：

| 文件名称            | 说明                   |
|-----------------|----------------------|
| entrypoint.sh   | 一个简单的启动脚本            |
| core-site.xml   | 一个简单的core-site.xml   |
| hdfs-site.xml   | 一个简单的hdfs-site.xml   |
| mapred-site.xml | 一个简单的mapred-site.xml |
| yarn-site.xml   | 一个简单的yarn-site.xml   |

## 配置文件内容示例
```yaml{4,7,33,54,71,109}
apiVersion: v1
kind: ConfigMap
metadata:
  name: hadoop-configmap
data:

  entrypoint.sh: |
    #!/usr/bin/env bash
    
    # 设置环境变量
    HADOOP_HOME=${HADOOP_HOME-"/opt/component/hadoop"}
    export HADOOP_HOME=$HADOOP_HOME
    echo "export HADOOP_HOME=$HADOOP_HOME" >> /etc/profile
    echo "export PATH=$PATH:$HADOOP_HOME/bin" >> /etc/profile
    echo "export HADOOP_HOME=$HADOOP_HOME" >> /root/.bashrc
    echo "export PATH=$PATH:$HADOOP_HOME/bin" >> /root/.bashrc
    
    source /etc/profile
    
    # 保证网络加入正常 防止启动过快
    sleep 5s
    
    # namenode 格式化
    HDFS_META_HOME=/opt/component/storage/hadoop
    if [ -z "$(ls -A ${HDFS_META_HOME})" ] && [[ "$(echo "$@" | grep "namenode")" != "" ]]; then
      echo "hdfs namenode -format" 
      hdfs namenode -format
    fi
    
    echo "$@"
    exec "$@"

  core-site.xml: |  
    <!-- core-site.xml 文件内容 -->
    <configuration>
        <property>
            <name>fs.defaultFS</name>
            <value>hdfs://namenode-service</value>
        </property> 
        <property>
            <name>hadoop.tmp.dir</name>
            <value>/opt/component/storage/hadoop/temporarily</value>
        </property>  
        <property>
            <name>hadoop.proxyuser.root.hosts</name>
            <value>*</value>
        </property>
        <property>
            <name>hadoop.proxyuser.root.groups</name>
            <value>*</value>
        </property>
    </configuration>    

  hdfs-site.xml: |
    <!-- hdfs-site.xml 文件内容 -->
    <configuration>
        <property>
            <name>dfs.namenode.name.dir</name>
            <value>file:/opt/component/storage/hadoop/namenode</value>
        </property>
        <property>
            <name>dfs.datanode.data.dir</name>
            <value>file:/opt/component/storage/hadoop/datanode</value>
        </property>
        <property>
            <name>dfs.replication</name>
            <value>2</value>
        </property>
    </configuration>

  mapred-site.xml: |
    <!-- mapred-site.xml 文件内容 -->
    <configuration>
        <property>
            <!--指定Mapreduce运行在yarn上-->
            <name>mapreduce.framework.name</name>
            <value>yarn</value>
        </property>
        <property>
          <name>yarn.app.mapreduce.am.env</name>
          <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
        </property>
        <property>
          <name>mapreduce.map.env</name>
          <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
        </property>
        <property>
          <name>mapreduce.reduce.env</name>
          <value>HADOOP_MAPRED_HOME=${HADOOP_HOME}</value>
        </property>    
        <property>
            <name>mapreduce.map.memory.mb</name>
            <value>1024</value>
        </property>
        <property>
            <name>mapreduce.map.java.opts</name>
            <value>-Xms819m -Xmx819m</value>
        </property>
        <property>
            <name>mapreduce.reduce.memory.mb</name>
            <value>2048</value>
        </property>
        <property>
            <name>mapreduce.reduce.java.opts</name>
            <value>-Xms1638m -Xmx1638m</value>
        </property>
    </configuration>

  yarn-site.xml: |
    <!-- yarn-site.xml 文件内容 -->
    <configuration>
        <property>
            <name>yarn.nodemanager.aux-services</name>
            <value>mapreduce_shuffle</value>
        </property>    
        <property>
            <name>yarn.resourcemanager.hostname</name>
            <value>resourcemanager-service</value>
        </property>
        <property>
            <name>yarn.scheduler.minimum-allocation-mb</name>
            <value>1024</value>
        </property>    
        <property>
            <name>yarn.scheduler.maximum-allocation-mb</name>
            <value>3072</value>
        </property>    
        <property>
          <name>yarn.app.mapreduce.am.resource.mb</name>
          <value>2048</value>
        </property>
        <property>
          <name>arn.app.mapreduce.am.command-opts</name>
          <value>-Xms1638m -Xmx1638m</value>
        </property>    
        <property>
            <name>yarn.nodemanager.resource.memory-mb</name>
            <value>3072</value>
        </property>
        <property>
          <name>yarn.resourcemanager.address</name>
          <value>resourcemanager-service</value>
        </property>    
        <property>
          <name>yarn.resourcemanager.scheduler.address</name>
          <value>resourcemanager-service</value>
        </property>    
        <property>
          <name>yarn.resourcemanager.resource-tracker.address</name>
          <value>resourcemanager-service</value>
        </property>
    </configuration>
      

```

## 参考

- [https://docs.cloudera.com/HDPDocuments/HDP2/HDP-2.1.1/bk_installing_manually_book/content/rpm-chap1-11.html](https://docs.cloudera.com/HDPDocuments/HDP2/HDP-2.1.1/bk_installing_manually_book/content/rpm-chap1-11.html)  
- [https://developer.aliyun.com/article/5911](https://developer.aliyun.com/article/5911)



