FROM ibm-semeru-runtimes:open-21-jdk as jdk
FROM conduktor/conduktor-console:${TAG}
COPY --from=jdk /opt/java/openjdk/ /opt/java/openjdk/
# docker buildx build  --platform linux/arm64,linux/amd64 -t registry.cn-shenzhen.aliyuncs.com/gravitation/conduktor-console:${TAG} -f Dockerfile . --push --no-cache
