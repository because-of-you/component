import os
import socket
import sys


def get_or_default(key: str, default_value: str = "") -> str:
    value = os.getenv(key)
    if value:
        return value
    return default_value


if __name__ == '__main__':
    # 书写配置文件zoo.config
    sys.stdout = open(
        f"{get_or_default('KAFKA_CONF_DIR', default_value='/opt/component/kafka_2.12-3.1.2/config')}/server.properties",
        "a")

    print("listeners = PLAINTEXT://0.0.0.0:9092")

    ZOOKEEPER_REPLICAS = int(get_or_default("ZOOKEEPER_REPLICAS", default_value="3"))
    zkCluster = [f"component-zookeeper-{i}" for i in range(1, ZOOKEEPER_REPLICAS + 1)]
    print(f"zookeeper.connect={','.join(zkCluster)}")

    # 副本数
    # fixme 存在一定bug 容器编号不是从1开始
    REPLICAS = int(get_or_default("KAFKA_REPLICAS", default_value="3"))
    COMPOSE_PROJECT_NAME = get_or_default("COMPOSE_PROJECT_NAME")
    COMPOSE_SERVICE_NAME = get_or_default("COMPOSE_SERVICE_NAME")

    for i in range(1, 1 + REPLICAS):
        node_name = f"{COMPOSE_PROJECT_NAME}-{COMPOSE_SERVICE_NAME}-{i}"

        target_ip = socket.gethostbyname(node_name)
        current_ip = socket.gethostbyname(socket.gethostname())

        if target_ip == current_ip:
            print(f"broker.id={i}")
            print(f"advertised.listeners=PLAINTEXT://{node_name}:9092")

    sys.stdout.close()
