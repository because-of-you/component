FROM ibm-semeru-runtimes:open-17-jdk as jdk
FROM docker.io/bitnami/kafka:3.8.0-debian-12-r2
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/
