#!/bin/bash
# 服务器部署脚本：构建镜像并启动 Atlas。
# 用法（服务器 /root/atlas 下执行）：bash deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 构建镜像"
docker compose build

echo "==> 启动/重启服务"
docker compose up -d

echo "==> 健康检查"
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:18081/ >/dev/null 2>&1; then
    echo "Atlas 已就绪: http://127.0.0.1:18081"
    exit 0
  fi
  sleep 2
done

echo "Atlas 启动超时，请检查: docker compose logs atlas" >&2
exit 1