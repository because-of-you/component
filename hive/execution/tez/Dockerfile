FROM busybox:latest

COPY ./tez/tez-dist/target/*.tar.gz /opt/component/tez/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]