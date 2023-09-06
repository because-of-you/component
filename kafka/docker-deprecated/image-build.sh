#!/bin/bash
#docker build -f DockerFile --force-rm -t wfybelief/component:kafka .

docker buildx build -f DockerFile --platform linux/arm64,linux/amd64 -t wfybelief/component:kafka . --push
