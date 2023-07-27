FROM python:3.11 as python

COPY . .

WORKDIR /src

RUN pip3 install -r ../requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    nuitka3 --show-memory --show-progress --follow-imports --output-dir=out app.py -o app

#ENTRYPOINT ["tail", "-f", "/dev/null"]
#
# nuitka3 --standalone --show-memory --show-progress --follow-imports --output-dir=out --onefile app.py -o app

FROM alpine:latest as alpine
COPY --from=python /src src

ENTRYPOINT ["tail", "-f", "/dev/null"]


