#!/usr/bin/env bash

./builder

# 格式化相关
if [ -z "$(ls -A ${HDFS_META_HOME})" ]; then
  hdfs namenode -format
fi

# 保证网络加入正常 防止启动过快
sleep 2s

exec "$@"