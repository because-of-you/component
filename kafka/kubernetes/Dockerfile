ARG KAFKA_HOME="/opt/component/kafka"
ARG version=3.5.1
ARG scala_version=2.13
ARG KAFKA_HEAP_OPTS="\
        -XX:InitialRAMPercentage=35.0 \
        -XX:MaxRAMPercentage=35.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"

FROM python:3.11 as python

ADD kafka/kubernetes/builder.py .

RUN pip install pyinstaller && \
    pyinstaller -F builder.py


FROM busybox:latest as busybox
ARG KAFKA_HOME
ARG version
ARG scala_version

ADD  https://downloads.apache.org/kafka/$version/kafka_$scala_version-$version.tgz .
RUN busybox mkdir -p $KAFKA_HOME && \
    busybox tar -zxvf kafka_$scala_version-$version.tgz -C $KAFKA_HOME --strip-components 1

COPY kafka/extra/server_sample.properties $KAFKA_HOME/config/
ADD zookeeper/kubernetes/entrypoint.sh $KAFKA_HOME/
COPY --from=python /dist/builder $KAFKA_HOME/



# 运行环境
FROM wfybelief/jdk-17:dev as jdk

ARG KAFKA_HOME
ARG KAFKA_HEAP_OPTS

COPY --from=busybox $KAFKA_HOME $KAFKA_HOME

WORKDIR $KAFKA_HOME

ENV PATH=$KAFKA_HOME/bin:$PATH KAFKA_HOME=$KAFKA_HOME KAFKA_HEAP_OPTS=$KAFKA_HEAP_OPTS

ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
#CMD ["zkServer.sh", "start-foreground"]
CMD ["kafka-server-start.sh", "config/server.properties"]

