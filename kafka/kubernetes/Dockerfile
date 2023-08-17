# 第一阶段拷贝kafka的release
FROM bitnami/kafka:3.5.1 as kafka

# 第二阶段 openj9 | 降低内存 |
FROM wfybelief/jdk-17:dev as jdk

COPY --from=kafka /opt/bitnami/kafka/ /opt/component/kafka/

# 设置普通变量|环境变量相关
ARG KAFKA_HOME=/opt/component/kafka

ENV KAFKA_HOME=$KAFKA_HOME \
    PATH=$KAFKA_HOME/bin:$PATH \
#    KAFKA_HEAP_OPTS=

COPY entrypoint.sh .

ENTRYPOINT ["busybox", "sh"]
CMD ["entrypoint.sh"]

