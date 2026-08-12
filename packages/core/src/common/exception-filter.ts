import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { DuplicateError, NotFoundError, ValidationError } from './response.js'

/**
 * 全局异常过滤器：把自定义错误与 Nest 内建异常统一映射为 { code, message, data } 信封，
 * 并确保 HTTP 状态码语义正确、内部异常细节不泄漏给客户端。
 * - ValidationError → 400
 * - NotFoundError  → 404
 * - DuplicateError → 409
 * - HttpException  → 保持其状态码
 * - 其他未知异常   → 500（通用文案，内部细节仅记服务端日志）
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest()

    if (exception instanceof ValidationError) {
      res.status(400).json({ code: 400, message: exception.message, data: null })
      return
    }
    if (exception instanceof NotFoundError) {
      res.status(404).json({ code: 404, message: exception.message, data: null })
      return
    }
    if (exception instanceof DuplicateError) {
      res.status(409).json({ code: 409, message: exception.message, data: null })
      return
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] })?.message ?? exception.message
      res.status(status).json({ code: status, message: Array.isArray(message) ? message.join('; ') : message, data: null })
      return
    }

    // 未知异常：不透出内部细节（可能含 SQL/路径/堆栈）
    const err = exception as Error
    this.logger.error(`未处理异常 ${req?.method ?? ''} ${req?.url ?? ''}：${err?.stack ?? err?.message ?? exception}`)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误', data: null })
  }
}