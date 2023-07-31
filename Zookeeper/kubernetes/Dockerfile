FROM zookeeper as zookeeper


FROM wfybelief/jdk-8:dev as jdk

COPY --from=zookeeper /apache-zookeeper-3.8.1-bin /zookeeper
COPY --from=zookeeper /conf /zookeeper/conf


WORKDIR /zookeeper/bin
COPY entrypoint.sh .

ENTRYPOINT ["busybox", "sh", "./entrypoint.sh"]
CMD ["/zookeeper/bin/zkServer.sh", "start-foreground"]