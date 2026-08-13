import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Inject } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error, NotFoundError, ValidationError } from '../common/response.js'
import { pageParams } from '../common/utils.js'
import { DatasetService } from './dataset.service.js'
import { parseMultipart } from '../plugins/plugin-dispatch.utils.js'
import type { DatasetCreateRequest } from '@atlas/types'

/** 数据集管理端点（管理面）。 */
@Controller('/api/apps')
export class DatasetController {
  constructor(@Inject(DatasetService) private readonly service: DatasetService) {}

  @Get(':appId/datasets')
  list(@Param('appId') appId: string, @Query('page') page?: string, @Query('size') size?: string) {
    const { page: p, size: s } = pageParams(page, size)
    return ok(this.service.listPage(Number(appId), p, s))
  }

  @Post(':appId/datasets')
  create(@Param('appId') appId: string, @Body() body: DatasetCreateRequest) {
    try {
      return ok(this.service.create(Number(appId), body ?? {}))
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Delete(':appId/datasets/:datasetId')
  remove(@Param('appId') appId: string, @Param('datasetId') datasetId: string) {
    try {
      this.service.remove(Number(appId), Number(datasetId))
      return ok(null)
    } catch (e) {
      const err = e as Error
      if (err instanceof NotFoundError) return error(404, err.message)
      return error(409, err.message)
    }
  }

  /** 上传资产：multipart（files[].originalname/buffer）或 JSON base64（files[].path/base64）。 */
  @Post(':appId/datasets/:datasetId/assets')
  async uploadAsset(@Param('appId') appId: string, @Param('datasetId') datasetId: string, @Req() req: Request) {
    try {
      let path = ''
      let mime = ''
      let buffer: Buffer | null = null
      const contentType = req.header('content-type') ?? ''
      if (contentType.includes('multipart/form-data')) {
        const part = await parseMultipart(req)
        const f = part.files?.[0]
        if (!f?.buffer) throw new ValidationError('缺少文件')
        path = f.originalname ?? ''
        mime = f.mimetype ?? ''
        buffer = f.buffer
      } else {
        const body = (req.body ?? {}) as { path?: string; mime?: string; base64?: string }
        if (!body.base64) throw new ValidationError('缺少文件（base64）')
        buffer = Buffer.from(body.base64, 'base64')
        path = body.path ?? ''
        mime = body.mime ?? ''
      }
      return ok(this.service.uploadAsset(Number(appId), Number(datasetId), path, mime, buffer!))
    } catch (e) {
      const err = e as Error
      if (err instanceof NotFoundError) return error(404, err.message)
      return error(400, err.message)
    }
  }

  @Delete(':appId/datasets/:datasetId/assets/:path(*)')
  removeAsset(@Param('appId') appId: string, @Param('datasetId') datasetId: string, @Param('path') path: string) {
    try {
      return ok(this.service.removeAsset(Number(appId), Number(datasetId), path))
    } catch (e) {
      const err = e as Error
      if (err instanceof NotFoundError) return error(404, err.message)
      return error(400, err.message)
    }
  }

  @Put(':appId/datasets/:datasetId')
  update(@Param('appId') appId: string, @Param('datasetId') datasetId: string, @Body() body: Record<string, unknown>) {
    try {
      return ok(this.service.update(Number(appId), Number(datasetId), body ?? {}))
    } catch (e) {
      const err = e as Error
      if (err instanceof NotFoundError) return error(404, err.message)
      return error(400, err.message)
    }
  }

  @Post(':appId/datasets/:datasetId/refresh')
  async refresh(@Param('appId') appId: string, @Param('datasetId') datasetId: string) {
    try {
      const dataset = this.service.list(Number(appId)).find((d) => d.id === Number(datasetId))
      if (!dataset) return error(404, '数据集不存在')
      return ok({ changed: await this.service.refreshByKey(Number(appId), dataset.pluginType, dataset.datasetKey) })
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/datasets/:datasetId/secrets')
  upsertSecret(@Param('appId') appId: string, @Param('datasetId') datasetId: string, @Body() body: { keyName?: string; value?: string }) {
    try {
      const dataset = this.service.list(Number(appId)).find((d) => d.id === Number(datasetId))
      if (!dataset) return error(404, '数据集不存在')
      return ok(this.service.upsertSecret(dataset, body?.keyName ?? '', body?.value ?? ''))
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Post(':appId/datasets/:datasetId/grants')
  grant(@Param('datasetId') datasetId: string, @Body() body: { appId?: number }) {
    try {
      if (!body?.appId) return error(400, '缺少 appId')
      this.service.grant(Number(datasetId), body.appId)
      return ok(null)
    } catch (e) {
      return error(400, (e as Error).message)
    }
  }

  @Delete(':appId/datasets/:datasetId/grants/:grantAppId')
  revokeGrant(@Param('datasetId') datasetId: string, @Param('grantAppId') grantAppId: string) {
    this.service.revokeGrant(Number(datasetId), Number(grantAppId))
    return ok(null)
  }

  @Get(':appId/datasets/:datasetId/audit')
  audit(@Param('datasetId') datasetId: string) {
    return ok(this.service.audit(Number(datasetId)))
  }
}
