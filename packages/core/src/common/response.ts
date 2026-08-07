import { ApiResponse } from '@atlas/types'

/** 通用响应工具（与 Java 版 ApiResponse 对齐）。 */
export const ok = <T>(data: T): ApiResponse<T> => ({ code: 0, message: 'ok', data })
export const error = (code: number, message: string): ApiResponse<null> => ({ code, message, data: null })

export class ValidationError extends Error {
  constructor(message: string, public readonly field = '') {
    super(message)
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message)
  }
}
