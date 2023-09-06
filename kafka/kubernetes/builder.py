import logging
import os.path
import shutil
from os import uname_result

from typing import Sequence

logging.basicConfig(level=logging.INFO, format=logging.BASIC_FORMAT)
BASE_DIR = "/opt/component"
SERVICE_NAME = "kafka"
CONF_DIR = "config"

path = os.path.join(BASE_DIR, SERVICE_NAME, CONF_DIR)


def server_properties(identity: str):
    DATA_DIR = "/opt/component/storage/log"
    with open(os.path.join(path, "server.properties"), "r") as file:
        for line in file.readlines():
            words = line.split("=")
            if len(words) != 2:
                continue
            if words[0] == "log.dirs":
                DATA_DIR = words[-1].strip()

        file.close()

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with open(os.path.join(path, "server.properties"), "a+") as file:
        file.write("broker.id=" + identity + os.linesep)
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

    shutil.copy2(os.path.join(path, "server_sample.properties"), os.path.join(path, "server.properties"))

    # server.properties
    server_properties(identity)


if __name__ == '__main__':
    main()
