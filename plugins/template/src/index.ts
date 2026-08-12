import type { AtlasPlugin, PluginEnvironment } from '@atlas/types'

/**
 * 插件模板：复制本目录即可开发新插件。
 * 目录结构：manifest.json（{pluginType, name, description, version, defaultDataScope, entry}）
 *          + schema.sql（可选：插件自有表建表 SQL，框架自动执行，须幂等 CREATE TABLE IF NOT EXISTS）
 *          + src/index.ts（本文件）+ ui/（前端面板产物，可选）
 */
const plugin: AtlasPlugin = {
  type: 'your-plugin-type', // 全局唯一（与 manifest.pluginType 一致）
  name: '插件名称',
  describe: '插件说明',
  defaultDataScope: 'APP_LOCAL', // APP_LOCAL=应用独立 / GLOBAL_SHARED=全局共享（store/files 共享一份）

  async init(env: PluginEnvironment) {
    // 可选：实例启用时初始化（如种子数据、资源准备）
    env.info('插件已初始化')
  },

  endpoints: () => [
    {
      method: 'GET',
      path: 'hello',
      summary: '示例端点（/api/apps/{appId}/plugins/{type}/ep/hello）',
      handle: async (env, params, body) => {
        await env.ops().info('hello 被调用')
        return { message: 'hello from plugin', config: env.config() }
      },
    },
  ],
}

export default plugin
