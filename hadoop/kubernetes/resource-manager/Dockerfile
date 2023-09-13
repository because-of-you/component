FROM wfybelief/namenode:dev as namenode
ARG HADOOP_HOME=/opt/component/hadoop
ARG YARN_RESOURCEMANAGER_OPTS="\
        -XX:InitialRAMPercentage=60.0 \
        -XX:MaxRAMPercentage=60.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ENV YARN_RESOURCEMANAGER_OPTS=$YARN_RESOURCEMANAGER_OPTS
WORKDIR $HADOOP_HOME
#COPY hadoop/kubernetes/datanode/entrypoint.sh .

#ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
#CMD ["hdfs", "datanode"]
ENTRYPOINT ["top", "-b"]