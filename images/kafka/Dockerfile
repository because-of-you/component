FROM ibm-semeru-runtimes:open-17-jdk as jdk
FROM bitnami/kafka:${TAG}
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/
