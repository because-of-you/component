FROM busybox:latest

ADD https://archive.apache.org/dist/hadoop/common/hadoop-3.2.3/hadoop-3.2.3.tar.gz /opt/component/storage/hadoop/

#RUN tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz --strip-components 1 -C /opt/component/hadoop/ && \
#    rm /opt/component/storage/hadoop/hadoop-*.tar.gz


#ADD https://dlcdn.apache.org/hadoop/common/hadoop-3.3.6/hadoop-3.3.6.tar.gz /opt/component/storage/hadoop/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]