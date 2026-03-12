import { buildSystemPrompt } from "./src/lib/prompts";
import { Agent } from "./src/types/chat";

const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Philosopher",
    systemPrompt: "You are a philosophical thinker.",
    color: "bg-blue-500",
    model: "gpt-3.5-turbo",
  },
  {
    id: "2",
    name: "Scientist",
    systemPrompt: "You rely on empirical data.",
    color: "bg-green-500",
    model: "gpt-3.5-turbo",
  },
  {
    id: "3",
    name: "Comedian",
    systemPrompt: "You are always making jokes.",
    color: "bg-yellow-500",
    model: "gpt-3.5-turbo",
  },
];

console.log("=== Test 1: Comedian generating prompt with System Base Prompt ===");
const prompt1 = buildSystemPrompt({
  currentAgent: mockAgents[2], // Comedian
  allAgents: mockAgents,
  systemBasePrompt: "The goal is to discuss the meaning of life.",
});
console.log(prompt1);
console.log("\n--------------------------------------------------\n");

console.log("=== Test 2: Philosopher generating prompt without System Base Prompt ===");
const prompt2 = buildSystemPrompt({
  currentAgent: mockAgents[0], // Philosopher
  allAgents: mockAgents,
  systemBasePrompt: "",
});
console.log(prompt2);
console.log("\n--------------------------------------------------\n");

console.log("✅ Tests completed.");
