ARG KAFKA_BASE_IMAGE=bitnamilegacy/kafka
ARG KAFKA_TAG=4.0.0-debian-12-r10

FROM ibm-semeru-runtimes:open-17-jdk AS openj9
FROM ${KAFKA_BASE_IMAGE}:${KAFKA_TAG}

# Keep Bitnami's Kafka image and scripts, but replace its bundled HotSpot JDK
# with the OpenJ9 runtime used by the previous component images.
COPY --from=openj9 --chown=1001:1001 /opt/java/openjdk/ /opt/bitnami/java/

ENV JAVA_HOME=/opt/bitnami/java \
    PATH=/opt/bitnami/java/bin:${PATH}
