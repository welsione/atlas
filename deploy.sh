#!/bin/bash
# 服务器部署脚本：拉取最新镜像并重启 AIBase。
# 用法（服务器上执行）：bash deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 拉取最新镜像"
docker compose pull

echo "==> 重启服务"
docker compose up -d

echo "==> 健康检查"
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:18081/api/providers >/dev/null 2>&1; then
    echo "AIBase 已就绪: http://127.0.0.1:18081"
    exit 0
  fi
  sleep 2
done

echo "AIBase 启动超时，请检查: docker compose logs aibase" >&2
exit 1
