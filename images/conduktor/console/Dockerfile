FROM dockerproxy.cn/ibm-semeru-runtimes:open-17-jdk as jdk
FROM dockerproxy.cn/conduktor/conduktor-console:1.25.1
COPY --from=jdk /opt/java/openjdk/ /opt/java/openjdk/
# docker buildx build  --platform linux/arm64,linux/amd64 -t registry.cn-shenzhen.aliyuncs.com/gravitation/conduktor-console:1.25.1 -f Dockerfile . --push --no-cache
