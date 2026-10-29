ARG CONSOLE_TAG=1.48.1

FROM ibm-semeru-runtimes:open-21-jdk AS openj9
FROM conduktor/conduktor-console:${CONSOLE_TAG}

COPY --from=openj9 /opt/java/openjdk/ /opt/java/openjdk/
