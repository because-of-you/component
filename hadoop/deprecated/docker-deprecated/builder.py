import os
import socket
import sys
import time


def get_or_default(key: str, default_value: str = "") -> str:
    value = os.getenv(key)
    if value:
        return value
    return default_value


if __name__ == '__main__':
    os.system("mkdir -p /opt/hadoop/logs/")
    # 副本数
    REPLICAS = int(get_or_default("HADOOP_REPLICAS", default_value="3"))
    COMPOSE_PROJECT_NAME = get_or_default("COMPOSE_PROJECT_NAME")
    COMPOSE_SERVICE_NAME = get_or_default("COMPOSE_SERVICE_NAME")

    time.sleep(10)

    for i in range(1, 1 + REPLICAS):
        node_name = f"{COMPOSE_PROJECT_NAME}-{COMPOSE_SERVICE_NAME}-{i}"
        target_ip = socket.gethostbyname(node_name)

        current_ip = socket.gethostbyname(socket.gethostname())

        if target_ip != current_ip:
            continue

        # 如果是 name node
        if get_or_default("NAME_NODE") and node_name in get_or_default("NAME_NODE"):
            os.system(
                "nohup hdfs namenode -format >>/opt/hadoop/logs/node.log && hdfs namenode >>/opt/hadoop/logs/node.log &")

        # 如果是 data node
        if get_or_default("DATA_NODE") and node_name in get_or_default("DATA_NODE"):
            os.system("nohup hdfs datanode >>/opt/hadoop/logs/node.log &")
            os.system(
                "nohup yarn node-manager >>/opt/hadoop/logs/node.log &")

        # todo 如果是yarn node
        # yarn resourcemanager
        if get_or_default("YARN_NODE") and node_name in get_or_default("YARN_NODE"):
            os.system("nohup hdfs datanode >>/opt/hadoop/logs/node.log &")
            os.system("nohup yarn resourcemanager >>/opt/hadoop/logs/node.log &")
