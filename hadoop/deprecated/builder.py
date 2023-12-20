import logging
import os.path
import xml.etree.ElementTree as ET

from xml.dom import minidom

logging.basicConfig(level=logging.INFO, format=logging.BASIC_FORMAT)
BASE_DIR = "/opt/component"
SERVICE_NAME = "hadoop"
CONF_DIR = "etc/hadoop"
HOSTNAME = os.uname().nodename
HDFS_META_HOME = os.getenv("HDFS_META_HOME")
PATH = os.path.join(BASE_DIR, SERVICE_NAME, CONF_DIR)


def add_property_on_root(root, name, value):
    content = ET.tostring(root).decode()
    if name in content:
        return
    property = root.makeelement("property", {})
    root.append(property)

    name_tag = property.makeelement("name", {})
    property.append(name_tag)
    name_tag.text = name

    value_tag = property.makeelement("value", {})
    property.append(value_tag)
    value_tag.text = value


def core_site_xml():
    logging.info("脚本初始化core-site.xml中")
    tree: ET.ElementTree = ET.parse(f"{PATH}/samples/core-site.xml")
    root = tree.getroot()
    add_property_on_root(root, name="fs.defaultFS", value=f"hdfs://{HOSTNAME}")
    add_property_on_root(root, name="hadoop.tmp.dir", value=f"{HDFS_META_HOME}/temporarily")
    xml_str = (ET.tostring(root).decode()
               .replace("\n", "")
               .replace("\r", "")
               .replace(" ", ""))
    with open(f"{PATH}/core-site.xml", "w", encoding="UTF-8") as file:
        file.write(minidom.parseString(xml_str).toprettyxml(indent="   ", newl=os.linesep))
        file.close()
    logging.info("脚本初始化core-site.xml成功")


def hdfs_site_xml():
    logging.info("脚本初始化hdfs-site.xml中")
    tree: ET.ElementTree = ET.parse(f"{PATH}/samples/hdfs-site.xml")
    root = tree.getroot()
    add_property_on_root(root, name="dfs.namenode.name.dir", value=f"file:{HDFS_META_HOME}/namenode")
    add_property_on_root(root, name="dfs.datanode.data.dir", value=f"file:{HDFS_META_HOME}/datanode")
    xml_str = (ET.tostring(root).decode()
               .replace("\n", "")
               .replace("\r", "")
               .replace(" ", ""))
    with open(f"{PATH}/hdfs-site.xml", "w", encoding="UTF-8") as file:
        file.write(minidom.parseString(xml_str).toprettyxml(indent="   ", newl=os.linesep))
        file.close()
    logging.info("脚本初始化hdfs-site.xml成功")


def mapred_site():
    logging.info("脚本初始化mapred-site.xml中")
    tree: ET.ElementTree = ET.parse(f"{PATH}/samples/mapred-site.xml")
    root = tree.getroot()
    xml_str = (ET.tostring(root).decode()
               .replace("\n", "")
               .replace("\r", "")
               .replace(" ", ""))
    with open(f"{PATH}/mapred-site.xml", "w", encoding="UTF-8") as file:
        file.write(minidom.parseString(xml_str).toprettyxml(indent="   ", newl=os.linesep))
        file.close()
    logging.info("脚本初始化mapred-site.xml成功")


def yarn_site():
    logging.info("脚本初始化yarn-site.xml中")
    tree: ET.ElementTree = ET.parse(f"{PATH}/samples/yarn-site.xml")
    root = tree.getroot()
    xml_str = (ET.tostring(root).decode()
               .replace("\n", "")
               .replace("\r", "")
               .replace(" ", ""))
    add_property_on_root(root, name="yarn.resourcemanager.hostname", value=f"{HOSTNAME}")
    with open(f"{PATH}/yarn-site.xml", "w", encoding="UTF-8") as file:
        file.write(minidom.parseString(xml_str).toprettyxml(indent="   ", newl=os.linesep))
        file.close()
    logging.info("脚本初始化yarn-site.xml成功")


def main():
    # if not os.path.exists(path):
    #     os.makedirs(path)

    # uname: uname_result = os.uname()
    # logging.info(f"当前获取的节点信息为 {uname}")
    # logging.info(f"解析的节点名称是 {uname.nodename}")
    #
    # splits: Sequence = uname.nodename.split("-")
    #
    # identity = splits[-1]
    # logging.info(f"解析的id是 {identity}")
    #
    # shutil.copy2(os.path.join(path, "server_sample.properties"), os.path.join(path, "server.properties"))

    # core-site.xml
    if not os.path.exists(HDFS_META_HOME):
        os.makedirs(HDFS_META_HOME)
    core_site_xml()
    hdfs_site_xml()
    mapred_site()
    yarn_site()


if __name__ == '__main__':
    main()
