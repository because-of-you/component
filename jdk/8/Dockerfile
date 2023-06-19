FROM busybox:latest as busybox
RUN busybox mkdir -p "/opt/tools" && \
    busybox wget https://arthas.aliyun.com/arthas-boot.jar -O /opt/tools/arthas.jar && \
    echo "#!/bin/bash" > /usr/bin/arthas && \
    echo "java -jar /opt/tools/arthas.jar" >> /usr/bin/arthas && \
    busybox chmod +x /usr/bin/arthas


FROM ibm-semeru-runtimes:open-8-jdk-jammy as jdk

COPY --from=busybox /bin/busybox /usr/bin/
COPY --from=busybox /usr/bin/arthas /usr/bin/
COPY --from=busybox /opt/tools/arthas.jar /opt/tools/


RUN apt-get update && \
    apt-get -y install libjemalloc-dev && \
    apt-get autoclean && \
    rm -rf /var/lib/apt/lists/*


ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so MALLOC_ARENA_MAX=2 TZ=Asia/Shanghai




