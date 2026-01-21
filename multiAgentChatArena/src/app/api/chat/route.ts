import { NextResponse } from 'next/server';
import { ApiConfiguration, ModelProvider } from '@/types/chat';

export async function POST(req: Request) {
  try {
    const { messages, currentAgent, allAgents, apiConfig } = await req.json();

    const config = apiConfig as ApiConfiguration;
    const model = (currentAgent.model || "gpt-3.5-turbo") as ModelProvider;

    // Determine Provider
    let providerConfig;
    if (model.startsWith("gemini")) {
      providerConfig = config.google;
    } else if (model.startsWith("qwen")) {
      providerConfig = config.alibaba;
    } else if (model.includes("moonshot")) {
      providerConfig = config.moonshot;
    } else if (model === "local") {
      providerConfig = config.local;
    } else {
      // Default to OpenAI for gpt-3.5, gpt-4, or unknown
      providerConfig = config.openai;
    }

    const apiKey = providerConfig.apiKey;
    const baseUrl = providerConfig.baseUrl.replace(/\/+$/, ""); // Remove trailing slash

    // If an API key is provided OR it's a local model (which might not need a key), use the real API
    if (apiKey || model === "local") {
      const systemMessage = {
        role: "system",
        content: `You are ${currentAgent.name}. Your personality/instruction is: "${currentAgent.systemPrompt}".
        
        You are currently in a group chat with the following participants:
        ${allAgents.map((a: any) => `- ${a.name}: ${a.systemPrompt}`).join('\n')}
        
        Respond to the conversation naturally as your character. Keep your response concise (under 3 sentences) and engaging. 
        Interact with the other agents' specific points. Do not prefix your response with your name.`
      };

      const conversationHistory = messages.map((msg: any) => {
        const role = msg.agentId === currentAgent.id ? "assistant" : "user";
        return {
          role,
          name: msg.agentName.replace(/\s+/g, '_'), // Standardize name for API
          content: msg.content
        };
      });

      // Process history to ensure alternating roles and no consecutive same roles
      const processedHistory: { role: string; content: string }[] = [];

      // Initial message if history is empty
      if (conversationHistory.length === 0) {
        processedHistory.push({
          role: "user",
          content: "Hello! Please introduce yourself and start the conversation."
        });
      } else {
        conversationHistory.forEach((msg: any) => {
          if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === msg.role) {
            // Merge consecutive same roles - concatenating directly for "clean content" as requested
            processedHistory[processedHistory.length - 1].content += `\n\n${msg.content}`;
          } else {
            processedHistory.push(msg);
          }
        });
      }

      // Ensure history starts and ends with user (strict providers like Gemini/Ollama)
      if (processedHistory.length > 0 && processedHistory[0].role === "assistant") {
        processedHistory.unshift({
          role: "user",
          content: "Let's start the discussion."
        });
      }
      if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === "assistant") {
        processedHistory.push({
          role: "user",
          content: "Please continue."
        });
      }

      // Create a list of names to strip (mentions) for the final clean-up
      const agentNames = allAgents.map((a: any) => a.name);

      const payload = {
        model: model === "local" ? currentAgent.localModelName || "qwen/qwen3-vl-8b" : model,
        messages: [
          systemMessage,
          ...processedHistory.map(msg => {
            let content = msg.content;

            // Remove specific @AgentName mentions
            agentNames.forEach((name: string) => {
              const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const mentionRegex = new RegExp(`@${escapedName}\\b`, 'g');
              content = content.replace(mentionRegex, '');
            });
            content = content.replace(/@\S+/g, '').trim().replace(/\s+/g, ' ');

            return {
              role: msg.role,
              content: content || "(continues)"
            };
          })
        ],
        temperature: 0.7,
        max_tokens: 150,
      };

      const endpoint = `${baseUrl}/chat/completions`;

      console.log(`Calling ${model} at ${endpoint}`);
      console.log(`[API Request Payload] ${model}:`, JSON.stringify(payload, null, 2));

      const apiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!apiResponse.ok) {
        let errorMsg = `API Error: ${apiResponse.status} ${apiResponse.statusText}`;
        try {
          const errorData = await apiResponse.json();
          console.error("Downstream API Error Data:", errorData);
          errorMsg = errorData.error?.message || JSON.stringify(errorData) || errorMsg;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errorMsg);
      }

      const data = await apiResponse.json();
      console.log(`[RAW API RESPONSE DEBUG] ${model}:`, JSON.stringify(data, null, 2));

      // Extract content, but be careful with empty strings which are technically valid but falsy
      let responseContent = data.choices?.[0]?.message?.content;

      // Fallback to other possible locations if message.content is undefined/null
      if (responseContent === undefined || responseContent === null) {
        responseContent = data.choices?.[0]?.text
          || data.message?.content
          || (typeof data === 'string' ? data : null);
      }

      // If it's still null/undefined, then it's a real format error
      if (responseContent === null || responseContent === undefined) {
        console.error("Unexpected API Response Format (Missing Content):", JSON.stringify(data, null, 2));
        throw new Error("Invalid response format from API. Could not find content in response.");
      }

      // If it is an empty string, provide a placeholder so the UI doesn't look broken
      let trimmedContent = typeof responseContent === 'string' ? responseContent.trim() : JSON.stringify(responseContent);
      if (trimmedContent === "") {
        trimmedContent = "(The model returned an empty response)";
      }
      console.log(`[API Response] ${model}: "${trimmedContent}"`);

      return NextResponse.json({
        content: trimmedContent,
      });
    }

    // --- FALLBACK / SIMULATION MODE (No API Key) ---

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const lastMessage = messages[messages.length - 1];
    let responseContent = "";

    if (!lastMessage) {
      const openers = [
        `Hello everyone! I am ${currentAgent.name}. I'm looking forward to this discussion.`,
        `Greetings! ${currentAgent.name} here. Shall we begin?`,
        `Hi all, I'm ${currentAgent.name}. Ready to dive in.`
      ];
      responseContent = openers[Math.floor(Math.random() * openers.length)];
    } else {
      const topics = ["AI ethics", "space exploration", "future technology", "human psychology", "global economics"];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      if (currentAgent.name.toLowerCase().includes("philosopher")) {
        responseContent = `That is a fascinating point, ${lastMessage.agentName}. But we must ask: what is the underlying nature of this?`;
      } else if (currentAgent.name.toLowerCase().includes("scientist")) {
        responseContent = `I see your point, ${lastMessage.agentName}. However, do we have empirical data to support this hypothesis regarding ${randomTopic}?`;
      } else {
        const responses = [
          `I agree with ${lastMessage.agentName}, but have we considered the impact on ${randomTopic}?`,
          `That's an interesting perspective. From my point of view as ${currentAgent.name}, I think it's more complex.`,
          `I'm not sure I entirely follow. ${lastMessage.agentName}, could you expand on that?`,
          `Exactly! And to add to that, I believe we are missing a key element here.`
        ];
        responseContent = responses[Math.floor(Math.random() * responses.length)];
      }
    }

    return NextResponse.json({
      content: responseContent,
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch response',
      details: error.message
    }, { status: 500 });
  }
}
