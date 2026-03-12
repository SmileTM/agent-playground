import { Agent } from "@/types/chat";

interface BuildSystemPromptProps {
  currentAgent: Agent;
  allAgents: Agent[];
  systemBasePrompt?: string;
}

export function buildSystemPrompt({
  currentAgent,
  allAgents,
  systemBasePrompt,
}: BuildSystemPromptProps): string {
  const otherAgents = allAgents.filter((a) => a.id !== currentAgent.id);
  const basePromptContext = systemBasePrompt ? `${systemBasePrompt}\n\n` : "";
  const otherAgentsContext =
    otherAgents.length > 0
      ? otherAgents.map((a) => `- ${a.name}: ${a.systemPrompt}`).join("\n")
      : "None";

  return `${basePromptContext}## 参与聊天的其他智能体 (Other Agents in Chat)
${otherAgentsContext}

---
你是 ${currentAgent.name}。你的性格/行为准则设定是："${currentAgent.systemPrompt}"。

请自然地扮演你的角色参与对话。尽量保持回复简明扼要（3句话以内）并且有趣。
请积极与其他智能体的观点进行互动。回复内容中不要以你自己的名字作为前缀。`;
}
