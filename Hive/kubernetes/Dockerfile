ARG HDFS_NAMENODE_OPTS="\
        -XX:InitialRAMPercentage=60.0 \
        -XX:MaxRAMPercentage=60.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ARG HDFS_META_HOME=/opt/component/storage
ARG HADOOP_HOME=/opt/component/hadoop

FROM apache/hive:3.1.3 as hive
FROM wfybelief/jdk-8:dev as jdk

ARG HDFS_NAMENODE_OPTS
ARG HDFS_META_HOME
ARG HADOOP_HOME

COPY --from=hive /opt/hive /opt/component/hive
COPY --from=hive /opt/hadoop /opt/component/hadoop

ENV HDFS_NAMENODE_OPTS=$HDFS_NAMENODE_OPTS\
    HDFS_META_HOME=$HDFS_META_HOME\
    HADOOP_HOME=$HADOOP_HOME\
    PATH=$HADOOP_HOME/bin:$PATH

#ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
#CMD ["hdfs", "namenode"]
CMD ["top", "-b"]