FROM wfybelief/datanode:dev as datanode
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

ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
CMD ["yarn", "resourcemanager"]