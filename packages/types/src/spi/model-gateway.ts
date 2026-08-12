/**
 * @atlas/types/spi —— 插件间「一等能力」SPI 接口。
 *
 * 提供方插件在其 `provides()` 中返回能力工厂，`create(env)` 的返回类型即为此处定义的接口；
 * 消费方插件经 `env.spi<ModelGatewaySpi>('providers', 'model-gateway')` 名义类型安全地调用。
 * 运行时无跨插件 import（插件是动态 import 隔离的），仅类型在编译期共享。
 */

/** 对话消息（OpenAI /chat/completions 兼容）。 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelGatewayRequest {
  /** 供应商 id（providers 插件内）。 */
  providerId: number
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export interface ModelGatewayUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ModelGatewayResponse {
  content: string
  model: string
  usage?: ModelGatewayUsage
}

/**
 * providers 插件暴露的 `model-gateway` 命名空间能力：
 * 消费方插件可经 `env.spi('providers', 'model-gateway')` 调用 OpenAI 兼容供应商完成对话，
 * 无需感知供应商的密钥管理（Key 由 providers 用 env.crypto() 保管并与数据集一致）。
 */
export interface ModelGatewaySpi {
  /** 列出可用的 OpenAI 兼容供应商（含 baseUrl/模型，不含明文密钥）。 */
  listProviders(): Promise<Array<{ id: number; name: string; baseUrl: string; models: string[] }>>
  /** 调用 OpenAI 兼容 /chat/completions 完成对话。 */
  chat(req: ModelGatewayRequest): Promise<ModelGatewayResponse>
}