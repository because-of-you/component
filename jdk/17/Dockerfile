FROM busybox:latest as busybox

ADD http://arthas.aliyun.com/arthas-boot.jar /opt/tools/arthas.jar
RUN busybox mkdir -p "/opt/tools" && \
    echo "#!/bin/bash" > /usr/bin/arthas && \
    echo "java -jar /opt/tools/arthas.jar" >> /usr/bin/arthas && \
    busybox chmod +x /usr/bin/arthas


FROM ibm-semeru-runtimes:open-17-jdk-jammy as jdk

COPY --from=busybox /bin/busybox /usr/bin/
COPY --from=busybox /usr/bin/arthas /usr/bin/
COPY --from=busybox /opt/tools/arthas.jar /opt/tools/


RUN apt-get update && \
    apt-get -y install libjemalloc-dev && \
    apt-get autoclean && \
    rm -rf /var/lib/apt/lists/* && \
    if [ -f /usr/lib/x86_64-linux-gnu/libjemalloc.so ]; then ln -s /usr/lib/x86_64-linux-gnu/libjemalloc.so /usr/local/lib/libjemalloc.so; fi && \
    if [ -f /usr/lib/aarch64-linux-gnu/libjemalloc.so ]; then ln -s /usr/lib/aarch64-linux-gnu/libjemalloc.so /usr/local/lib/libjemalloc.so; fi


ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so MALLOC_ARENA_MAX=2 TZ=Asia/Shanghai
