import { NextResponse } from 'next/server';
import { createParser } from 'eventsource-parser';
import { ApiConfiguration, ModelProvider } from '@/types/chat';
import { buildSystemPrompt } from '@/lib/prompts';

export async function POST(req: Request) {
  try {
    const { messages, currentAgent, allAgents, systemBasePrompt, apiConfig } = await req.json();

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
      const systemMessageContent = buildSystemPrompt({
        currentAgent,
        allAgents,
        systemBasePrompt,
      });

      const systemMessage = {
        role: "system",
        content: systemMessageContent
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
        stream: true,
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
        signal: req.signal,
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

      // Setup transforming stream to send back JSONLine chunks
      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();

          // 1. Send our custom debug context first
          controller.enqueue(encoder.encode(JSON.stringify({ type: "debug", promptPayload: payload }) + "\n"));

          const reader = apiResponse.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          let buffer = "";
          try {
            const parser = createParser({
              onEvent(event: any) {
                const dataStr = event.data;
                if (dataStr === '[DONE]') return;
                try {
                  const dataObj = JSON.parse(dataStr);
                  const content = dataObj.choices?.[0]?.delta?.content || "";
                  const reasoning = dataObj.choices?.[0]?.delta?.reasoning_content || "";
                  
                  if (content || reasoning) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ type: "chunk", content, reasoning, raw: dataObj }) + "\n")
                    );
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data string:", dataStr, e);
                }
              }
            });

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              parser.feed(decoder.decode(value, { stream: true }));
            }
          } catch (streamErr) {
            console.error("Stream reading error:", streamErr);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
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
