# ===== 阶段 1：构建（types + core + web，全 TS monorepo）=====
FROM node:22-alpine AS build
WORKDIR /workspace

# better-sqlite3 原生模块需要编译工具链（使用阿里云镜像加速，海外源基本不可达）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++

# 先复制清单以利用构建缓存
COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/
RUN npm ci

# better-sqlite3 预编译二进制可能与本环境不兼容（SQLITE_IOERR_WRITE），强制从源码编译。
# node-gyp 官方头文件源不可达，改用阿里云镜像下载 node 头文件并指向编译。
ARG NODE_VERSION=22.23.2
RUN wget -qO /tmp/node-headers.tar.gz "https://mirrors.aliyun.com/nodejs-release/v${NODE_VERSION}/node-v${NODE_VERSION}-headers.tar.gz" && \
    mkdir -p /tmp/node-headers && tar -xzf /tmp/node-headers.tar.gz -C /tmp/node-headers --strip-components=1 && \
    npm rebuild better-sqlite3 --build-from-source --nodedir=/tmp/node-headers && \
    rm -rf /tmp/node-headers.tar.gz /tmp/node-headers

# 复制源码并构建
#  - npm run build        : 编译 @atlas/types + @atlas/core（tsc + schema + static）
#  - npm run sync:static  : 构建 @atlas/web 并同步到 core/static 与 core/dist/static
COPY packages/ packages/
COPY plugins/ plugins/
RUN npm run build && npm run sync:static

# ===== 阶段 2：运行 =====
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 完整 node_modules（含 better-sqlite3 原生模块，与 build 阶段同为 node:22-alpine，兼容）
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json

# monorepo 工作区包（node_modules/@atlas/* 相对符号链接指向 /app/packages/*，可解析）
COPY --from=build /workspace/packages/types ./packages/types
COPY --from=build /workspace/packages/core ./packages/core
COPY --from=build /workspace/packages/web ./packages/web

# 目录插件（运行时热加载）
COPY --from=build /workspace/plugins ./plugins

ENV ATLAS_PORT=18081
ENV ATLAS_DATA_DIR=/app/data
ENV ATLAS_PLUGINS_DIR=/app/plugins
EXPOSE 18081
VOLUME ["/app/data"]

WORKDIR /app/packages/core
CMD ["node", "dist/main.js"]