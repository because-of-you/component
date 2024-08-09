FROM dockerproxy.cn/ibm-semeru-runtimes:open-11.0.23_9-jdk as jdk
FROM dockerproxy.cn/bitnami/zookeeper:3.9.2-debian-12-r11
COPY --from=jdk /opt/java/openjdk/ /opt/bitnami/java/
# docker buildx build --platform 'linux/arm64,linux/amd64' -t registry.cn-shenzhen.aliyuncs.com/gravitation/zookeeper:3.9.2-debian-12-r11 -f Dockerfile . --push --no-cache

#docker buildx build --platform 'linux/arm64,linux/amd64' -t registry.cn-shenzhen.aliyuncs.com/gravitation/kafka:3.8.0-debian-12-r2 -f Dockerfile . --push --no-cache
#docker image prune -a
#docker system prune -a