import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as express from 'express'
import { AppModule } from './app.module.js'
import { loadConfig } from './config.js'

const config = loadConfig()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  const logger = new Logger('Bootstrap')

  // 前端静态资源（构建产物）：优先 core/static，回退 workspace web/dist
  const staticDirs = [
    resolve(__dirname, 'static'),
    resolve(__dirname, '../static'),
    resolve(__dirname, '../../../frontend/web/dist'),
  ]
  const staticDir = staticDirs.find((d) => existsSync(d))
  if (staticDir) {
    app.use(express.static(staticDir))
    // SPA fallback：非 /api 与 /_pluginui 路径回退 index.html
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      const path = req.path
      if (path.startsWith('/api/') || path.startsWith('/_pluginui') || path.startsWith('/icons/')) {
        next()
        return
      }
      req.url = '/index.html'
      next()
    })
    logger.log(`静态资源已挂载：${staticDir}`)
  } else {
    logger.warn('未找到前端构建产物（core/static 或 web/dist），仅 API 可用')
  }

  await app.listen(config.port)
  logger.log(`AIBase 已启动：http://127.0.0.1:${config.port}（data-dir=${config.dataDir}）`)
  if (!config.authEnabled) {
    logger.warn('未配置 AIBASE_ADMIN_PASSWORD / AIBASE_ADMIN_KEY，管理接口未启用认证（仅限本地开发，生产必须设置）')
  }
}

void bootstrap()
