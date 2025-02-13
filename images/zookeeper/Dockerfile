FROM ibm-semeru-runtimes:open-11-jdk as jdk
FROM bitnami/zookeeper:${TAG}
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/