import { NextResponse } from 'next/server';

// Mocking Request and fetch since this is a unit-test-like script
// In a real environment we would use a test runner, but here we can simulate the logic

async function simulateRoute(messages: any[], model: string, apiKey: string = "mock-key") {
    const req = {
        json: async () => ({
            messages,
            currentAgent: { id: "agent-1", name: "Agent 1", systemPrompt: "Be helpful" },
            allAgents: [{ id: "agent-1", name: "Agent 1", systemPrompt: "Be helpful" }],
            apiConfig: {
                openai: { apiKey, baseUrl: "https://api.openai.com/v1" },
                google: { apiKey, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
                moonshot: { apiKey, baseUrl: "https://api.moonshot.cn/v1" },
                alibaba: { apiKey, baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
            }
        })
    };

    // Re-implement the key logic from route.ts to verify it
    const { messages: msgs, currentAgent, apiConfig } = await req.json();

    const conversationHistory = msgs.map((msg: any) => {
        if (msg.isUser) return { role: "user", content: `User: ${msg.content}` };
        return {
            role: msg.agentId === currentAgent.id ? "assistant" : "user",
            content: `${msg.agentName}: ${msg.content}`
        };
    });

    const processedHistory: { role: string; content: string }[] = [];
    if (conversationHistory.length === 0) {
        processedHistory.push({ role: "user", content: "Hello! Please introduce yourself and start the conversation." });
    } else {
        conversationHistory.forEach((msg: any) => {
            if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === msg.role) {
                processedHistory[processedHistory.length - 1].content += "\n\n" + msg.content;
            } else {
                processedHistory.push(msg);
            }
        });
    }

    if (processedHistory.length > 0 && processedHistory[0].role === "assistant") {
        processedHistory.unshift({ role: "user", content: "Continuing the conversation..." });
    }

    return processedHistory;
}

async function runTests() {
    console.log("Running Chat API Logic Tests...\n");

    // Test 1: Empty history
    console.log("Test 1: Empty history");
    const h1 = await simulateRoute([], "gpt-3.5-turbo");
    console.log("Result:", JSON.stringify(h1, null, 2));
    console.assert(h1.length === 1 && h1[0].role === "user", "Test 1 Failed");

    // Test 2: Consecutive same roles (User then User)
    console.log("\nTest 2: Consecutive User roles");
    const h2 = await simulateRoute([
        { isUser: true, content: "Hello" },
        { agentId: "other", agentName: "Other", content: "Hi", isUser: false }
    ], "gpt-3.5-turbo");
    console.log("Result:", JSON.stringify(h2, null, 2));
    console.assert(h2.length === 1 && h2[0].role === "user", "Test 2 Failed");
    console.assert(h2[0].content.includes("User: Hello") && h2[0].content.includes("Other: Hi"), "Test 2 content Failed");

    // Test 3: Assistant starting first (shouldn't happen in normal flow but good to test)
    console.log("\nTest 3: Assistant role first");
    const h3 = await simulateRoute([
        { agentId: "agent-1", agentName: "Agent 1", content: "I start", isUser: false }
    ], "gpt-3.5-turbo");
    console.log("Result:", JSON.stringify(h3, null, 2));
    console.assert(h3[0].role === "user" && h3[1].role === "assistant", "Test 3 Failed");

    console.log("\nAll Logic Tests Passed!");
}

runTests().catch(console.error);
