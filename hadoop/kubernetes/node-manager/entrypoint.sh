#!/usr/bin/env bash

./builder

# 保证网络加入正常 防止启动过快
sleep 2s

exec "$@"