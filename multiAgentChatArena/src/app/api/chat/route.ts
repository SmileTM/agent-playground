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
    } else {
      // Default to OpenAI for gpt-3.5, gpt-4, or unknown
      providerConfig = config.openai;
    }

    const apiKey = providerConfig.apiKey;
    const baseUrl = providerConfig.baseUrl.replace(/\/+$/, ""); // Remove trailing slash

    // If an API key is provided, use the real API
    if (apiKey) {
      const systemMessage = {
        role: "system",
        content: `You are ${currentAgent.name}. Your personality/instruction is: "${currentAgent.systemPrompt}".
        
        You are currently in a group chat with the following participants:
        ${allAgents.map((a: any) => `- ${a.name}: ${a.systemPrompt}`).join('\n')}
        
        Respond to the conversation naturally as your character. Keep your response concise (under 3 sentences) and engaging. 
        Interact with the other agents' specific points. Do not prefix your response with your name.`
      };

      const conversationHistory = messages.map((msg: any) => {
        if (msg.isUser) {
          return {
            role: "user",
            content: `User: ${msg.content}`
          };
        }
        return {
          role: msg.agentId === currentAgent.id ? "assistant" : "user",
          content: `${msg.agentName}: ${msg.content}`
        };
      });

      // Process history to ensure alternating roles and no consecutive same roles
      // Some providers (like Gemini) are very strict about this.
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
            // Merge consecutive same roles
            processedHistory[processedHistory.length - 1].content += "\n\n" + msg.content;
          } else {
            processedHistory.push(msg);
          }
        });
      }

      // Ensure history starts with user and ends with user (for some strict providers)
      // Though usually starting with user is enough.
      if (processedHistory.length > 0 && processedHistory[0].role === "assistant") {
        processedHistory.unshift({
          role: "user",
          content: "Continuing the conversation..."
        });
      }

      const payload = {
        model: model,
        messages: [systemMessage, ...processedHistory],
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
          "Authorization": `Bearer ${apiKey}`,
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
      if (!data.choices?.[0]?.message?.content) {
        console.error("Unexpected API Response Format:", data);
        throw new Error("Invalid response format from API");
      }

      const responseContent = data.choices[0].message.content.trim();
      console.log(`[API Response] ${model}: "${responseContent}"`);

      return NextResponse.json({
        content: responseContent,
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
