FROM ibm-semeru-runtimes:open-11.0.23_9-jdk as jdk
FROM bitnami/zookeeper:3.9.2-debian-12-r11
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/