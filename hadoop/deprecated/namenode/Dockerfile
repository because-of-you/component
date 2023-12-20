ARG HDFS_NAMENODE_OPTS="\
        -XX:InitialRAMPercentage=60.0 \
        -XX:MaxRAMPercentage=60.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ARG HDFS_META_HOME=/opt/component/storage
ARG HADOOP_HOME=/opt/component/hadoop

FROM python:3.11 as python

COPY hadoop/kubernetes/builder.py .

RUN pip install pyinstaller && \
    pyinstaller -F builder.py


FROM apache/hadoop:3.3.6 as hadoop

COPY hadoop/kubernetes/namenode/entrypoint.sh /opt/hadoop/
#RUN mkdir "/opt/hadoop/etc/hadoop/samples" &&  \
#    cp /opt/hadoop/etc/hadoop/*.xml /opt/hadoop/etc/hadoop/samples/

#ENTRYPOINT ["top", "-b"]


FROM wfybelief/jdk-11:dev as jdk
ARG HDFS_NAMENODE_OPTS
ARG HDFS_META_HOME
ARG HADOOP_HOME

ENV HDFS_NAMENODE_OPTS=$HDFS_NAMENODE_OPTS\
    HDFS_META_HOME=$HDFS_META_HOME\
    HADOOP_HOME=$HADOOP_HOME\
    PATH=$HADOOP_HOME/bin:$PATH

WORKDIR $HADOOP_HOME
COPY --from=hadoop /opt/hadoop $HADOOP_HOME
COPY --from=python /dist/builder $HADOOP_HOME/



ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
CMD ["hdfs", "namenode"]
#CMD ["top", "-b"]

