"use client";

import { useState, useEffect, useRef } from "react";
import { Agent, Message, ModelProvider, ApiConfiguration, DEFAULT_API_CONFIG, ChatSession } from "@/types/chat";
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
  X,
  MessageSquare,
  Edit,
  Check,
  ChevronDown,
  ChevronRight
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
  { value: "local", label: "Local Model (Custom)" },
];

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({}); // SessionId -> isTyping
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const agents = activeSession?.agents || [];
  const messages = activeSession?.messages || [];
  const isAutoChatting = activeSession?.isAutoChatting || false;
  const activeAgentIndex = activeSession?.activeAgentIndex || 0;

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

  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set());

  const toggleAgentCollapse = (agentId: string) => {
    setCollapsedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem("chat_sessions");
    const savedActiveSessionId = localStorage.getItem("chat_active_session_id");

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
        }
      } catch (e) {
        console.error("Failed to parse sessions from localStorage", e);
      }
    } else {
      // First visit: Initialize default session
      const defaultSession: ChatSession = {
        id: "default",
        name: "General Chat",
        agents: INITIAL_AGENTS,
        messages: [],
        isAutoChatting: false,
        activeAgentIndex: 0,
        createdAt: Date.now()
      };
      setSessions([defaultSession]);
      setActiveSessionId("default");
    }

    if (savedActiveSessionId) {
      setActiveSessionId(savedActiveSessionId);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
  }, [sessions, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("chat_active_session_id", activeSessionId);
  }, [activeSessionId, isLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // No longer rely on [activeSessionId] for typing, check all
  }, [messages, isTyping]);

  const updateSession = (sessionId: string, updates: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newValues = typeof updates === 'function' ? updates(s) : updates;
        return { ...s, ...newValues };
      }
      return s;
    }));
  };

  const updateActiveSession = (updates: Partial<ChatSession>) => {
    if (!activeSession) return;
    updateSession(activeSession?.id || activeSessionId, updates);
  };

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages: [...s.messages, message] };
      }
      return s;
    }));
  };



  const getNextResponse = async (sessionId: string, forcedAgentIndex?: number, historyOverride?: Message[]) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.agents.length === 0) return;

    setIsTyping(prev => ({ ...prev, [sessionId]: true }));

    const indexToUse = forcedAgentIndex !== undefined ? forcedAgentIndex : session.activeAgentIndex;
    const currentAgent = session.agents[indexToUse];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyOverride || session.messages,
          currentAgent,
          allAgents: session.agents,
          apiConfig,
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

      addMessageToSession(sessionId, newMessage);

      if (forcedAgentIndex !== undefined) {
        updateSession(sessionId, { activeAgentIndex: (forcedAgentIndex + 1) % session.agents.length });
      } else {
        updateSession(sessionId, (prev) => ({ activeAgentIndex: (prev.activeAgentIndex + 1) % session.agents.length }));
      }
    } catch (error) {
      console.error("Failed to get response:", error);
    } finally {
      setIsTyping(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  useEffect(() => {
    // Check ALL sessions for auto-chat
    const timers: NodeJS.Timeout[] = [];

    sessions.forEach(session => {
      if (session.isAutoChatting && !isTyping[session.id]) {
        const timer = setTimeout(() => {
          getNextResponse(session.id);
        }, 2000);
        timers.push(timer);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [sessions, isTyping]); // Re-run when sessions change (messages added) or typing state changes

  const toggleAutoChat = () => {
    updateActiveSession({ isAutoChatting: !isAutoChatting });
  };

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

    const updatedMessages = [...messages, newMessage];

    // Optimistic update
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: updatedMessages };
      }
      return s;
    }));

    // Check for mentions to trigger specific response
    const mentionedAgent = agents.find(a => inputValue.includes(`@${a.name}`));

    // Add to history
    setInputHistory(prev => [inputValue, ...prev.filter(h => h !== inputValue)].slice(0, 50));
    setHistoryIndex(-1);
    setInputValue("");

    if (mentionedAgent) {
      setTimeout(() => {
        const agentIndex = agents.findIndex(a => a.id === mentionedAgent.id);
        if (agentIndex !== -1) {
          getNextResponse(activeSessionId, agentIndex, updatedMessages);
        }
      }, 500);
    }
  };

  const addAgent = () => {
    const randomPreset = AGENT_PRESETS[Math.floor(Math.random() * AGENT_PRESETS.length)];
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
    updateActiveSession({ agents: [...agents, newAgent] });
  };

  const removeAgent = (id: string) => {
    const newAgents = agents.filter(a => a.id !== id);
    let newIndex = activeAgentIndex;
    if (newIndex >= newAgents.length - 1) {
      newIndex = 0;
    }
    updateActiveSession({ agents: newAgents, activeAgentIndex: newIndex });
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    const newAgents = agents.map(a => a.id === id ? { ...a, ...updates } : a);
    updateActiveSession({ agents: newAgents });
  };

  const clearChat = () => {
    updateActiveSession({ messages: [], isAutoChatting: false, activeAgentIndex: 0 });
  };

  // Session Management
  const createSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `New Chat ${sessions.length + 1}`,
      agents: INITIAL_AGENTS,
      messages: [],
      isAutoChatting: false,
      activeAgentIndex: 0,
      createdAt: Date.now()
    };
    setSessions([...sessions, newSession]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Removed restriction for last session
    // if (sessions.length <= 1) return;

    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeSessionId === id) {
      // If we deleted the active session, switch to another or clear
      setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : "");
    }
  };

  const startEditingSession = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setNewSessionName(name);
  };

  const saveSessionName = (id: string) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, name: newSessionName } : s));
    setEditingSessionId(null);
  };

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(mentionQuery));

  if (!isLoaded) {
    return <div className="h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

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
        {/* Sessions Section */}
        <div className="flex flex-col border-b h-1/3 min-h-[200px]">
          <div className="h-16 px-4 border-b flex justify-between items-center bg-gray-50/50">
            <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              Chat Rooms
            </h2>
            <button
              onClick={createSession}
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-blue-600"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "p-2 rounded-lg cursor-pointer flex items-center justify-between group text-sm transition-colors",
                  activeSessionId === session.id ? "bg-blue-50 border-blue-100 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                )}
              >
                {editingSessionId === session.id ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      autoFocus
                      className="bg-white border rounded px-1 py-0.5 w-full text-xs"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveSessionName(session.id);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); saveSessionName(session.id); }} className="text-green-600"><Check className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <>
                    <span className="truncate flex-1 font-medium">{session.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditingSession(session.id, session.name, e)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Edit className="w-3 h-3 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                      // disabled={sessions.length <= 1} // REMOVED
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Agents Section Header */}
        <div className="h-16 px-4 border-b flex justify-between items-center bg-white sticky top-0 z-10" >
          <h2 className="font-bold text-xl flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            Agents
          </h2>
          <div className="flex gap-2">
            <button
              onClick={addAgent}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
              title="Add Agent"
              disabled={!activeSession} // Disable if no session
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
        </div >

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeSession && (
            <div className="text-center py-10 text-gray-400 italic font-medium">
              Select or Create a Chat
            </div>
          )}
          {activeSession && agents.map((agent) => {
            const isCollapsed = collapsedAgents.has(agent.id);

            return (
              <div key={agent.id} className="border rounded-xl bg-gray-50 relative group transition-all duration-200 overflow-hidden">
                {/* COLLAPSED VIEW */}
                {isCollapsed ? (
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleAgentCollapse(agent.id)}
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0", agent.color)}>
                      {agent.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 font-medium text-sm truncate select-none text-gray-700">
                      {agent.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAgent(agent.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove Agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* EXPANDED VIEW */
                  <div className="p-4 space-y-4">
                    {/* Header Controls */}
                    <div className="flex justify-between items-start">
                      <button
                        onClick={() => toggleAgentCollapse(agent.id)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Collapse"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => removeAgent(agent.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="Remove Agent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Profile Section (Center) */}
                    <div className="flex flex-col items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md", agent.color)}>
                        {agent.name[0].toUpperCase()}
                      </div>
                      <input
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                        className="text-center bg-transparent font-bold border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none text-base py-1 px-2 transition-all w-full max-w-[80%]"
                        placeholder="Agent Name"
                      />
                    </div>

                    {/* Settings Details */}
                    <div className="space-y-3 animate-in slide-in-from-top-1 duration-200 pt-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Model</label>
                        <select
                          value={agent.model}
                          onChange={(e) => {
                            const newModel = e.target.value as ModelProvider;
                            const updates: Partial<Agent> = { model: newModel };
                            if (newModel === "local" && !agent.localModelName) {
                              updates.localModelName = "qwen/qwen3-vl-8b";
                            }
                            updateAgent(agent.id, updates);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          {MODELS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>

                      {agent.model === "local" && (
                        <div className="animate-in slide-in-from-top-1 duration-150">
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Local Model Name</label>
                          <input
                            value={agent.localModelName || ""}
                            onChange={(e) => updateAgent(agent.id, { localModelName: e.target.value })}
                            placeholder="e.g. llama3, qwen2"
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Personality</label>
                        <textarea
                          value={agent.systemPrompt}
                          onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs h-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                        />
                      </div>

                      <div className="text-[10px] text-gray-300 text-center pt-1">
                        ID: {agent.id}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {activeSession && agents.length === 0 && (
            <div className="text-center py-10 text-gray-400 italic">
              No agents added. Click + to add one.
            </div>
          )}
        </div>
      </aside >

      {/* Main Chat Area */}
      {!activeSession ? (
        <section className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-12 h-12 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">No Active Chats</h2>
            <p className="text-gray-500 max-w-md">
              Create a new chat room to start letting agents talk to each other.
            </p>
          </div>
          <button
            onClick={createSession}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Chat
          </button>
        </section>
      ) : (
        <section className="flex-1 flex flex-col min-w-0" >
          {/* Header */}
          < header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6 shadow-sm" >
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
          </header >

          {/* Messages */}
          < div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
          >
            {
              messages.length === 0 && !isTyping[activeSessionId] && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <Bot className="w-16 h-16 opacity-20" />
                  <p>The arena is empty. Start auto-chat to begin the conversation.</p>
                </div>
              )
            }

            {
              messages.map((msg) => {
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
              })
            }

            {
              isTyping[activeSessionId] && (
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
              )
            }
          </div >

          {/* Input Area */}
          < div className="p-4 bg-white border-t relative" >
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
                disabled={!inputValue.trim() || isTyping[activeSessionId]}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-[10px] text-gray-400 mt-2 text-center">
              Use <strong>@AgentName</strong> to force a reply from a specific agent.
            </div>
          </div >
        </section >
      )}
    </main>
  );
}