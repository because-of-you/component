# https://github.com/acmesh-official/acme.sh
FROM ubuntu:latest

#ADD --keep-git-dir=true https://gitee.com/neilpang/acme.sh.git /opt/component/acme.sh/
#ADD --keep-git-dir=true https://gitee.com/he-zhangdi/raspberrypi-car.git#master /buildkit

ADD ./acme.sh/ /root/.acme.sh/
ADD https://gist.githubusercontent.com/anjia0532/9ebf8011322f43e3f5037bc2af3aeaa6/raw/65b359a4eed0ae990f9188c2afa22bacd8471652/renew-hook-update-apisix.sh /root/.acme.sh/renew-hook-update-apisix.sh

RUN apt-get update && \
    apt-get install curl -y && \
    /root/.acme.sh/acme.sh --install --email mail@acitrus.cn --force && \
    apt-get autoclean && \
    rm -rf /var/lib/apt/lists/*


ENTRYPOINT ["top", "-b"]