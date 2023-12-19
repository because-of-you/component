FROM busybox:latest

COPY ./tez/tez-dist/target/*.tar.gz /opt/component/storage/tez/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]