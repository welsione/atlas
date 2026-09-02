import { ElMessage } from 'element-plus'

/**
 * 复制到剪贴板：仅在写入成功时提示「已复制」；失败或 API 不可用（非安全上下文）
 * 时提示手动复制，避免无条件弹成功提示与未处理的 Promise rejection。
 */
export async function copyText(text: string, label: string): Promise<void> {
  // 非 HTTPS（局域网 IP 访问）下 navigator.clipboard 不可用：降级 execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) {
      ElMessage.success(`${label}已复制`)
      return
    }
  } catch {
    // 兜底也失败，走手动复制提示
  }
  ElMessage.info(`${label}：复制失败，请手动复制`)
}