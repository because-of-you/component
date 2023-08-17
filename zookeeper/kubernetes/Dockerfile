ARG ZOOKEEPER_HOME="/opt/component/zookeeper"
ARG version=3.9.0

# 第一阶段测试
FROM python:3.11 as python

ADD zookeeper/kubernetes/builder.py .

RUN pip install pyinstaller && \
    pyinstaller -F builder.py

# 打包解压文件
FROM busybox:latest as busybox

ARG ZOOKEEPER_HOME
ARG version


ADD https://dlcdn.apache.org/zookeeper/zookeeper-$version/apache-zookeeper-$version-bin.tar.gz apache-zookeeper-$version-bin.tar.gz
#ADD https://mirrors.ustc.edu.cn/apache/zookeeper/zookeeper-3.9.0/apache-zookeeper-3.9.0-bin.tar.gz apache-zookeeper-$version-bin.tar.gz

RUN busybox mkdir -p $ZOOKEEPER_HOME && \
    busybox tar -zxvf apache-zookeeper-$version-bin.tar.gz -C $ZOOKEEPER_HOME --strip-components 1

# 运行环境
FROM wfybelief/jdk-11:dev as jdk

ARG ZOOKEEPER_HOME
ARG version

COPY --from=busybox $ZOOKEEPER_HOME $ZOOKEEPER_HOME

WORKDIR $ZOOKEEPER_HOME
COPY --from=python /dist/builder .
ADD zookeeper/kubernetes/entrypoint.sh .

ENV PATH=$ZOOKEEPER_HOME/bin:$PATH ZOOKEEPER_HOME=$ZOOKEEPER_HOME

# todo 读取zoo.cfg中内容 zkDataDir, 然后写入到指定路径myid
ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
CMD ["zkServer.sh", "start-foreground"]