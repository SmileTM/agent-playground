export type ModelProvider = "gpt-3.5-turbo" | "gpt-4" | "gemini-pro" | "gemini-2.5-flash" | "qwen-turbo" | "moonshot-v1-8k" | "local";

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  color: string;
  avatar?: string;
  model: ModelProvider;
  localModelName?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  agents: Agent[];
  messages: Message[];
  isAutoChatting: boolean;
  activeAgentIndex: number;
  createdAt: number;
}

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: number;
  isUser?: boolean;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export interface ApiConfiguration {
  openai: ProviderConfig;
  google: ProviderConfig;
  moonshot: ProviderConfig;
  alibaba: ProviderConfig;
  local: ProviderConfig;
}

export const DEFAULT_API_CONFIG: ApiConfiguration = {
  openai: { apiKey: "", baseUrl: "https://api.openai.com/v1" },
  google: { apiKey: "", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  moonshot: { apiKey: "", baseUrl: "https://api.moonshot.cn/v1" },
  alibaba: { apiKey: "", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  local: { apiKey: "", baseUrl: "http://localhost:1234/v1" },
};

export interface ChatState {
  agents: Agent[];
  messages: Message[];
  isAutoChatting: boolean;
  activeAgentId: string | null;
}
