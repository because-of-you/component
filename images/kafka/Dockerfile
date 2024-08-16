FROM dockerproxy.cn/ibm-semeru-runtimes:open-17-jdk as jdk
FROM dockerproxy.cn/bitnami/kafka:3.8.0-debian-12-r3
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/
