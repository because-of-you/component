FROM busybox:latest as busybox
RUN busybox mkdir -p "/opt/tools"


FROM ibm-semeru-runtimes:open-11-jdk-jammy as jdk

COPY --from=busybox /bin/busybox /usr/bin/


RUN apt-get update && \
    apt-get -y install libjemalloc-dev && \
    apt-get autoclean && \
    rm -rf /var/lib/apt/lists/*


ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so MALLOC_ARENA_MAX=2 TZ=Asia/Shanghai

