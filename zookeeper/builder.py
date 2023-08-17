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
    sys.stdout = open(f"{get_or_default('ZOO_CONF_DIR')}/zoo.cfg", "w")
    print(f"dataDir={get_or_default('ZOO_DATA_DIR')}")
    print(f"dataLogDir={get_or_default('ZOO_DATA_LOG_DIR')}")
    print(f"tickTime={get_or_default('ZOO_TICK_TIME')}")
    print(f"initLimit={get_or_default('ZOO_INIT_LIMIT')}")
    print(f"syncLimit={get_or_default('ZOO_SYNC_LIMIT')}")
    print(f"autopurge.snapRetainCount={get_or_default('ZOO_AUTOPURGE_SNAPRETAINCOUNT')}")
    print(f"autopurge.purgeInterval={get_or_default('ZOO_AUTOPURGE_PURGEINTERVAL')}")
    print(f"maxClientCnxns={get_or_default('ZOO_MAX_CLIENT_CNXNS')}")
    # print(f"standaloneEnabled={get_or_default('ZOO_STANDALONE_ENABLED')}")
    print(f"admin.enableServer={get_or_default('ZOO_ADMINSERVER_ENABLED')}")
    print("clientPort=2181")

    # 副本数
    # fixme 存在一定bug 容器编号不是从1开始
    REPLICAS = int(get_or_default("ZOOKEEPER_REPLICAS"))
    COMPOSE_PROJECT_NAME = get_or_default("COMPOSE_PROJECT_NAME")
    COMPOSE_SERVICE_NAME = get_or_default("COMPOSE_SERVICE_NAME")
    for i in range(1, 1 + REPLICAS):
        node_name = f"{COMPOSE_PROJECT_NAME}-{COMPOSE_SERVICE_NAME}-{i}"
        print(f"server.{i}={node_name}:2888:3888;2181")
        target_ip = socket.gethostbyname(node_name)
        current_ip = socket.gethostbyname(socket.gethostname())

        if target_ip == current_ip:
            os.system(f"echo {i} > {get_or_default('ZOO_DATA_DIR')}/myid ")

    sys.stdout.close()