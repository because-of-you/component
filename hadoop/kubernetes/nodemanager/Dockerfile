FROM wfybelief/datanode:dev as datanode
ARG HADOOP_HOME=/opt/component/hadoop
ARG YARN_NODEMANAGER_OPTS="\
        -XX:InitialRAMPercentage=50.0 \
        -XX:MaxRAMPercentage=50.0 \
        -Xshareclasses \
        -Xtune:virtualized \
        -Xquickstart \
        -XX:+UseContainerSupport"
ENV YARN_NODEMANAGER_OPTS=$YARN_NODEMANAGER_OPTS
WORKDIR $HADOOP_HOME

ENTRYPOINT ["busybox", "sh", "entrypoint.sh"]
CMD ["yarn", "nodemanager"]
