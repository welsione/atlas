import { describe, expect, it } from '@jest/globals'
import { matchPath, sanitizeDispositionFilename, textContentType } from './plugin-dispatch.utils.js'

describe('matchPath', () => {
  it('匹配 {param} 占位符', () => {
    expect(matchPath('GET', 'update/{id}', 'update/42', 'GET')).toEqual({ id: '42' })
    expect(matchPath('GET', 'update/{id}', 'update/42', 'POST')).toBeNull()
    expect(matchPath('GET', 'update/{id}', 'other/42', 'GET')).toBeNull()
  })

  it('多段占位符', () => {
    expect(matchPath('GET', 'a/{x}/b/{y}', 'a/1/b/2', 'GET')).toEqual({ x: '1', y: '2' })
  })

  it('正则元字符按字面匹配（M5 回归：. + 不当作正则语义）', () => {
    // 修复前 'list.v2' 的 . 会匹配任意字符，'listXv2' 会被误命中
    expect(matchPath('GET', 'list.v2', 'listXv2', 'GET')).toBeNull()
    expect(matchPath('GET', 'list.v2', 'list.v2', 'GET')).toEqual({})
    // 修复前 'a+b' 的 + 会把 a 重复一次，'aab' 被误命中
    expect(matchPath('GET', 'a+b', 'aab', 'GET')).toBeNull()
    expect(matchPath('GET', 'a+b', 'a+b', 'GET')).toEqual({})
  })

  it('方法与大小写', () => {
    expect(matchPath('GET', 'list', 'list', 'get')).toEqual({}) // endpointMethod 大小写不敏感
    expect(matchPath('get', 'list', 'list', 'GET')).toBeNull() // method 需大写（与 req.method 一致）
  })

  it('路径必须完整匹配（拒绝前缀/尾斜杠）', () => {
    expect(matchPath('GET', 'list', 'list', 'GET')).toEqual({})
    expect(matchPath('GET', 'list', 'list/', 'GET')).toBeNull()
    expect(matchPath('GET', 'list', 'list/extra', 'GET')).toBeNull()
  })
})

describe('sanitizeDispositionFilename', () => {
  it('剥离控制字符与引号/反斜杠（防响应头注入）', () => {
    expect(sanitizeDispositionFilename('a"b\\c\nd')).toBe('a_b_c_d')
    expect(sanitizeDispositionFilename('正常文件名.pdf')).toBe('正常文件名.pdf')
  })

  it('截断超长文件名', () => {
    expect(sanitizeDispositionFilename('x'.repeat(300)).length).toBe(255)
  })
})

describe('textContentType', () => {
  it('文本类 MIME 附加 UTF-8 charset', () => {
    expect(textContentType('text/plain')).toBe('text/plain; charset=utf-8')
    expect(textContentType('application/json')).toBe('application/json; charset=utf-8')
  })

  it('二进制 MIME 不附加 charset', () => {
    expect(textContentType('application/octet-stream')).toBe('application/octet-stream')
    expect(textContentType('image/png')).toBe('image/png')
  })
})
