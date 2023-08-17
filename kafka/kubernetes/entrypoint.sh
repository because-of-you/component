#!/bin/bash

# 获取唯一id
identifier=${HOSTNAME##*-}

if ! [[ "$identifier" =~ ^[0-9]+$ ]]; then
    echo "不能使用表达式: identifier=\${HOSTNAME##*-} 提取唯一数字id HOSTNAME=$HOSTNAME identifier=$identifier | 示例HOSTNAME=xxx-1"
    tail
fi

# 构造文件
echo "broker.id=$identifier" >> "$KAFKA_HOME"/config/server.properties

# 启动
kafka-server-start.sh "$KAFKA_HOME"/config/server.properties
