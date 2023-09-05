ARG KAFKA_HOME="/opt/component/kafka"
ARG version=3.5.1
ARG scala_version=2.13

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

COPY kafka/extra/server.properties $KAFKA_HOME/config/server_sample.properties
ADD zookeeper/kubernetes/entrypoint.sh $KAFKA_HOME/
COPY --from=python /dist/builder $KAFKA_HOME/



# 运行环境
FROM wfybelief/jdk-17:dev as jdk

ARG KAFKA_HOME

COPY --from=busybox $KAFKA_HOME $KAFKA_HOME

WORKDIR $KAFKA_HOME

ENV PATH=$KAFKA_HOME/bin:$PATH KAFKA_HOME=$KAFKA_HOME

ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
#CMD ["zkServer.sh", "start-foreground"]
CMD ["top", "-b"]

