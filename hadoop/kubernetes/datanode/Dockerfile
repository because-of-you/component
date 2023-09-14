FROM wfybelief/namenode:main as namenode
ARG HADOOP_HOME=/opt/component/hadoop
ARG HDFS_DATANODE_OPTS="\
        -XX:InitialRAMPercentage=40.0 \
        -XX:MaxRAMPercentage=40.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ENV HDFS_DATANODE_OPTS=$HDFS_DATANODE_OPTS
WORKDIR $HADOOP_HOME
COPY hadoop/kubernetes/datanode/entrypoint.sh .

ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
CMD ["hdfs", "datanode"]