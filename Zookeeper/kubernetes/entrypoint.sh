#!/usr/bin/env bash
cd /zookeeper/conf
mv zoo_sample.cfg zoo.cfg

# 获取唯一id
identifier=${HOSTNAME##*-}

if ! [[ "$identifier" =~ ^[0-9]+$ ]]; then
    echo "不能使用表达式: identifier=\${HOSTNAME##*-} 提取唯一数字id HOSTNAME=$HOSTNAME identifier=$identifier | 示例HOSTNAME=xxx-1"
    tail
fi


echo "$identifier" >> /tmp/zookeeper/myid
echo "server.1=zk-1:2888:3888;2181" >> zoo.cfg

exec "$@"