import logging
import os.path
from os import uname_result

from typing import Sequence

logging.basicConfig(level=logging.INFO, format=logging.BASIC_FORMAT)
BASE_DIR = "/opt/component"
SERVICE_NAME = "zookeeper"
CONF_DIR = "conf"


path = os.path.join(BASE_DIR, SERVICE_NAME, CONF_DIR)


def my_id_file(identity: str):
    DATA_DIR = "/tmp/zookeeper"
    with open(os.path.join(path, "zoo.cfg"), "r") as file:
        for line in file.readlines():
            words = line.split("=")
            if len(words) != 2:
                continue
            if words[0] == "dataDir":
                DATA_DIR = words[-1].strip()

        file.close()

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with open(os.path.join(DATA_DIR, "myid"), "w+") as file:
        file.write(identity + os.linesep)
        file.close()


def zoo_conf_config(identity: str, node_name: str):
    with open(os.path.join(path, "zoo.cfg"), "a+") as file:
        for i in range((int(identity) + 1)):
            file.write(f"server.{i}={node_name}:2888:3888;2181" + os.linesep)
        file.close()


def main():
    if not os.path.exists(path):
        os.makedirs(path)

    uname: uname_result = os.uname()
    logging.info(f"当前获取的节点信息为 {uname}")
    logging.info(f"解析的节点名称是 {uname.nodename}")

    splits: Sequence = uname.nodename.split("-")

    identity = splits[-1]
    logging.info(f"解析的id是 {identity}")

    # zoo.cfg
    zoo_conf_config(identity, uname.nodename)

    # myid
    my_id_file(identity)


if __name__ == '__main__':
    main()
