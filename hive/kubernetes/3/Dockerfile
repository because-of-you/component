ARG HIVE_METASTORE_HADOOP_OPTS="\
        -XX:InitialRAMPercentage=60.0 \
        -XX:MaxRAMPercentage=60.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ARG HDFS_META_HOME=/opt/component/storage
ARG HADOOP_HOME=/opt/component/hadoop
ARG HIVE_HOME=/opt/component/hive

FROM apache/hive:3.1.3 as hive
# FROM wfybelief/namenode:0.0.5 as hadoop
FROM wfybelief/jdk-8:0.0.6 as jdk

ARG HIVE_METASTORE_HADOOP_OPTS
ARG HDFS_META_HOME
ARG HADOOP_HOME
ARG HIVE_HOME

# HADOOP_CLIENT_OPTS
# HIVE_METASTORE_HADOOP_OPTS
# HIVE_SERVER2_HADOOP_OPTS
COPY --from=hive /opt/hive /opt/component/hive
# COPY --from=hadoop /opt/component/hadoop /opt/component/hadoop

ENV HIVE_METASTORE_HADOOP_OPTS=$HIVE_METASTORE_HADOOP_OPTS\
    HDFS_META_HOME=$HDFS_META_HOME\
    HADOOP_HOME=$HADOOP_HOME\
    PATH=$HADOOP_HOME/bin:$PATH\
    HIVE_HOME=$HIVE_HOME\
    PATH=$HIVE_HOME/bin:$PATH

#ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
#CMD ["hdfs", "namenode"]
CMD ["top", "-b"]