/**
 * 展示层格式化工具。
 * 后端时间戳统一为 UTC「YYYY-MM-DD HH:mm:ss」（common/utils.ts now()），
 * 展示时必须转本地时区，禁止裸渲染原始字符串。
 */

/** 后端时间字符串 → 本地时区「YYYY/MM/DD HH:mm」。非法输入原样返回。 */
export function fmtTime(s?: string | null): string {
  if (!s) return ''
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
