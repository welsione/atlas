import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ok, error, NotFoundError, ValidationError } from '../common/response.js'
import { DatasetService } from './dataset.service.js'
import type { DatasetCreateRequest } from '@atlas/types'

/** 数据集管理端点（管理面）。 */
@Controller('/api/apps')
export class DatasetController {
  constructor(private readonly service: DatasetService) {}

  @Get(':appId/datasets')
  list(@Param('appId') appId: string) {
    return ok(this.service.list(Number(appId)))
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
      return error(404, (e as Error).message)
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
