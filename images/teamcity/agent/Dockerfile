FROM ibm-semeru-runtimes:open-8-jdk as open-8-jdk
FROM ibm-semeru-runtimes:open-11-jdk as open-11-jdk
FROM ibm-semeru-runtimes:open-17-jdk as open-17-jdk
FROM ibm-semeru-runtimes:open-21-jdk as open-21-jdk
FROM jetbrains/teamcity-agent:2024.03.1 as base
LABEL authors="wangfeiyu"

COPY --from=open-8-jdk /opt/java/openjdk/* /opt/buildagent/tools/open-8-jdk/
COPY --from=open-11-jdk /opt/java/openjdk/* /opt/buildagent/tools/open-11-jdk/
COPY --from=open-17-jdk /opt/java/openjdk/* /opt/buildagent/tools/open-17-jdk/
COPY --from=open-21-jdk /opt/java/openjdk/* /opt/buildagent/tools/open-21-jdk/


ENV TEAMCITY_AGENT_OPTS="-Xshareclasses -Xtune:virtualized -Xquickstart" \
    MALLOC_ARENA_MAX=2 \
    TZ=Asia/Shanghai \
    TEAMCITY_LAUNCHER_OPTS="-Xshareclasses -Xtune:virtualized -Xquickstart"
