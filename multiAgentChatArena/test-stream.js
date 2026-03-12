async function test() {
  const payload = {
    messages: [{role: "user", agentId: "0", agentName: "user", content: "hello"}],
    currentAgent: { id: "1", name: "test", model: "local" },
    allAgents: [],
    systemBasePrompt: '我们是一家富有科技感的公司，目标是为了改变世界。在遇到需要特定的人处理相关事情时，可直接 “@名字 + 内容”。 \n\n',
    apiConfig: { local: { baseUrl: "http://localhost:1234/v1" } }
  };

  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("Status:", res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while(true) {
      const { done, value } = await reader.read();
      if (done) { console.log("DONE"); break; }
      const chunk = decoder.decode(value, { stream: true });
      console.log("CHUNK RECEIVED:", chunk.length, "bytes");
      console.log("CHUNK START===\n" + chunk + "\n===CHUNK END");
    }
  } catch (e) {
    console.error(e);
  }
}
test().catch(console.error);
