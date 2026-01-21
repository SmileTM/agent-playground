"use client";

import { useState, useEffect, useRef } from "react";
import { Agent, Message, ModelProvider, ApiConfiguration, DEFAULT_API_CONFIG } from "@/types/chat";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Settings2,
  RefreshCw,
  Bot,
  Send,
  Menu,
  X
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";

const INITIAL_AGENTS: Agent[] = [
  {
    id: "1",
    name: "Philosopher",
    systemPrompt: "You are a contemplative philosopher who likes to question assumptions.",
    color: "bg-blue-500",
    model: "gpt-3.5-turbo",
  },
  {
    id: "2",
    name: "Scientist",
    systemPrompt: "You are a pragmatic scientist focused on empirical evidence and data.",
    color: "bg-green-500",
    model: "gpt-3.5-turbo",
  },
];

const AGENT_PRESETS: Partial<Agent>[] = [
  {
    name: "Debater",
    systemPrompt: "You are a skilled debater who loves to play devil's advocate. Challenge every point logically.",
    color: "bg-orange-500",
    model: "gpt-3.5-turbo"
  },
  {
    name: "Poet",
    systemPrompt: "You are a lyrical poet. You speak in rhymes and metaphors, finding beauty in everything.",
    color: "bg-pink-500",
    model: "gpt-4"
  },
  {
    name: "Coder",
    systemPrompt: "You are a senior software engineer. You analyze everything through the lens of algorithms and efficiency.",
    color: "bg-indigo-500",
    model: "gemini-pro"
  },
  {
    name: "Alien",
    systemPrompt: "You are an extraterrestrial visitor confused by human customs. Ask naive but insightful questions.",
    color: "bg-green-600",
    model: "gpt-3.5-turbo"
  },
  {
    name: "Historian",
    systemPrompt: "You are an obsessed historian. You constantly draw parallels between current topics and historical events.",
    color: "bg-amber-700",
    model: "qwen-turbo"
  },
  {
    name: "GenZ",
    systemPrompt: "You are a Gen Z internet user. Use slang (fr, no cap, bet) and keep things casual and trendy.",
    color: "bg-purple-600",
    model: "moonshot-v1-8k"
  },
  {
    name: "Stoic",
    systemPrompt: "You are a Stoic philosopher. You preach emotional control and acceptance of fate.",
    color: "bg-stone-600",
    model: "gpt-3.5-turbo"
  },
  {
    name: "Comedian",
    systemPrompt: "You are a stand-up comedian. You can't help but crack jokes and find the humor in every situation.",
    color: "bg-yellow-500",
    model: "gpt-3.5-turbo"
  }
];

const MODELS: { value: ModelProvider; label: string }[] = [
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gemini-pro", label: "Gemini Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "qwen-turbo", label: "Qwen (Tongyi)" },
  { value: "moonshot-v1-8k", label: "Kimi (Moonshot)" },
];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAutoChatting, setIsAutoChatting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfiguration>(DEFAULT_API_CONFIG);

  const scrollRef = useRef<HTMLDivElement>(null);

  const [inputValue, setInputValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const getNextResponse = async (forcedAgentIndex?: number) => {
    if (agents.length === 0) return;

    setIsTyping(true);
    // Use forced index if provided (from mention), otherwise current rotation
    const indexToUse = forcedAgentIndex !== undefined ? forcedAgentIndex : activeAgentIndex;
    const currentAgent = agents[indexToUse];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          currentAgent,
          allAgents: agents,
          apiConfig, // Pass the full config
        }),
      });

      const data = await response.json();

      const newMessage: Message = {
        id: Date.now().toString(),
        agentId: currentAgent.id,
        agentName: currentAgent.name,
        content: data.content,
        timestamp: Date.now(),
      };

      addMessage(newMessage);

      // If we forced an agent, resume rotation from the NEXT one
      if (forcedAgentIndex !== undefined) {
        setActiveAgentIndex((forcedAgentIndex + 1) % agents.length);
      } else {
        setActiveAgentIndex((prev) => (prev + 1) % agents.length);
      }
    } catch (error) {
      console.error("Failed to get response:", error);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoChatting && !isTyping) {
      timer = setTimeout(() => {
        getNextResponse();
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [isAutoChatting, isTyping, activeAgentIndex, agents]);

  const toggleAutoChat = () => setIsAutoChatting(!isAutoChatting);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Simple mention detection: check if the last word starts with @
    const lastWord = value.split(" ").pop();
    if (lastWord && lastWord.startsWith("@")) {
      setShowMentions(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(mentionQuery));

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredAgents.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredAgents.length) % filteredAgents.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredAgents[mentionIndex]) {
          selectAgent(filteredAgents[mentionIndex]);
        }
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }

    if (e.key === "ArrowUp" && !e.shiftKey) {
      if (historyIndex === -1) {
        setTempInput(inputValue);
      }
      const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
      if (newIndex !== historyIndex && inputHistory.length > 0) {
        setHistoryIndex(newIndex);
        setInputValue(inputHistory[inputHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown" && !e.shiftKey) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(inputHistory[inputHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue(tempInput);
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectAgent = (agent: Agent) => {
    const words = inputValue.split(" ");
    words.pop(); // Remove the partial @mention
    const newValue = words.join(" ") + (words.length > 0 ? " " : "") + `@${agent.name} `;
    setInputValue(newValue);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      agentId: "user",
      agentName: "You",
      content: inputValue.trim(),
      timestamp: Date.now(),
      isUser: true,
    };

    addMessage(newMessage);

    // Check for mentions to trigger specific response
    const mentionedAgent = agents.find(a => inputValue.includes(`@${a.name}`));

    // Add to history
    setInputHistory(prev => [inputValue, ...prev.filter(h => h !== inputValue)].slice(0, 50));
    setHistoryIndex(-1);
    setInputValue("");

    if (mentionedAgent) {
      // If auto-chat is on, pause it briefly or just let the forced response happen
      // We'll trigger the mentioned agent immediately
      setTimeout(() => {
        const agentIndex = agents.findIndex(a => a.id === mentionedAgent.id);
        if (agentIndex !== -1) {
          getNextResponse(agentIndex);
        }
      }, 500); // Small delay for natural feel
    } else if (isAutoChatting) {
      // If chatting is already on, the loop will pick up the new context
    }
  };

  const addAgent = () => {
    // Randomly pick a preset that isn't already used (if possible), or just random
    const randomPreset = AGENT_PRESETS[Math.floor(Math.random() * AGENT_PRESETS.length)];

    // Ensure unique name if possible by appending number
    let uniqueName = randomPreset.name!;
    let counter = 2;
    while (agents.some(a => a.name === uniqueName)) {
      uniqueName = `${randomPreset.name} ${counter}`;
      counter++;
    }

    const newAgent: Agent = {
      id: Date.now().toString(),
      name: uniqueName,
      systemPrompt: randomPreset.systemPrompt || "You are a helpful assistant.",
      color: randomPreset.color || "bg-blue-500",
      model: (randomPreset.model as ModelProvider) || "gpt-3.5-turbo",
    };
    setAgents([...agents, newAgent]);
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
    if (activeAgentIndex >= agents.length - 1) {
      setActiveAgentIndex(0);
    }
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const clearChat = () => {
    setMessages([]);
    setIsAutoChatting(false);
    setActiveAgentIndex(0);
  };

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(mentionQuery));

  return (
    <main className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden relative">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={apiConfig}
        setConfig={setApiConfig}
      />

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar: Agent Configuration */}
      <aside className={cn(
        "w-80 bg-white flex flex-col shadow-sm fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 md:relative md:translate-x-0 border-r",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            Agents
          </h2>
          <div className="flex gap-2">
            <button
              onClick={addAgent}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
              title="Add Agent"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="p-4 border rounded-xl bg-gray-50 space-y-3 relative group">
              <button
                onClick={() => removeAgent(agent.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Name</label>
                <input
                  value={agent.name}
                  onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                  className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm py-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Model</label>
                <select
                  value={agent.model}
                  onChange={(e) => updateAgent(agent.id, { model: e.target.value as ModelProvider })}
                  className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm py-1"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Personality</label>
                <textarea
                  value={agent.systemPrompt}
                  onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                  className="w-full bg-transparent border border-gray-300 rounded p-2 text-xs h-20 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", agent.color)} />
                <span className="text-xs text-gray-400">ID: {agent.id}</span>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="text-center py-10 text-gray-400 italic">
              No agents added. Click + to add one.
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg md:hidden"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="font-bold text-lg whitespace-nowrap">Chat Arena</h1>
            <div className="flex -space-x-2 overflow-x-auto no-scrollbar py-1">
              {agents.map((agent, i) => (
                <div
                  key={agent.id}
                  className={cn(
                    "w-8 h-8 flex-shrink-0 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold transition-transform",
                    agent.color,
                    activeAgentIndex === i && "ring-2 ring-blue-500 scale-110 z-10"
                  )}
                  title={agent.name}
                >
                  {agent.name[0]}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button
              onClick={clearChat}
              className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={toggleAutoChat}
              disabled={agents.length < 2}
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition-all shadow-sm text-sm md:text-base",
                isAutoChatting
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              )}
            >
              {isAutoChatting ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden md:inline">Stop Auto-Chat</span>
                  <span className="md:hidden">Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden md:inline">Start Auto-Chat</span>
                  <span className="md:hidden">Start</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Bot className="w-16 h-16 opacity-20" />
              <p>The arena is empty. Start auto-chat to begin the conversation.</p>
            </div>
          )}

          {messages.map((msg) => {
            const agent = agents.find(a => a.id === msg.agentId);
            const isUser = msg.isUser;

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
                  isUser ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!isUser && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase", agent?.color || "bg-gray-400")}>
                      {msg.agentName}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {isUser && "You • "}
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div
                  className={cn(
                    "max-w-[80%] border shadow-sm p-4 text-gray-800 leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "bg-blue-600 text-white rounded-2xl rounded-tr-none border-blue-600"
                      : "bg-white rounded-2xl rounded-tl-none"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex flex-col animate-pulse">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase", agents[activeAgentIndex]?.color)}>
                  {agents[activeAgentIndex]?.name} is thinking...
                </span>
              </div>
              <div className="w-16 h-10 bg-gray-200 rounded-2xl rounded-tl-none flex items-center justify-center gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t relative">
          {showMentions && filteredAgents.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border rounded-lg shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 bg-gray-50 text-xs font-semibold text-gray-500 border-b">
                Mention an Agent
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredAgents.map((agent, i) => (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors",
                      i === mentionIndex && "bg-blue-50 text-blue-700"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", agent.color)} />
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-gray-100 rounded-xl p-2 border focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Use @ to mention an agent)"
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-sm"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-2 text-center">
            Use <strong>@AgentName</strong> to force a reply from a specific agent.
          </div>
        </div>
      </section>
    </main>
  );
}