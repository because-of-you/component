FROM busybox:latest

COPY ./hadoop/hadoop-dist/target/hadoop-*.tar.gz /opt/component/storage/hadoop/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]