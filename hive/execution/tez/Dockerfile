FROM busybox:latest

ADD ./tez/tez-dist/target/* /opt/component/tez/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]