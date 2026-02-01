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
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [isComposing, setIsComposing] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set());
  const [hoveredAgentIndex, setHoveredAgentIndex] = useState<number | null>(null);

  // Auto-scroll mention list when selection changes
  useEffect(() => {
    if (showMentions && mentionListRef.current) {
      const activeItem = mentionListRef.current.children[mentionIndex] as HTMLElement;
      if (activeItem) {
        const container = mentionListRef.current;
        const scrollOffset = activeItem.offsetTop - container.offsetTop;

        if (scrollOffset < container.scrollTop) {
          container.scrollTop = scrollOffset;
        } else if (scrollOffset + activeItem.offsetHeight > container.scrollTop + container.clientHeight) {
          container.scrollTop = scrollOffset + activeItem.offsetHeight - container.clientHeight;
        }
      }
    }
  }, [mentionIndex, showMentions]);

  // Click outside to close mentions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMentions && mentionPopupRef.current && !mentionPopupRef.current.contains(event.target as Node)) {
        setShowMentions(false);
      }
    };

    if (showMentions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentions]);

  // Collapsible Agents
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
    const cursor = e.target.selectionStart || 0;
    setInputValue(value);

    // Robust mention detection based on cursor position
    const textBeforeCursor = value.substring(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx !== -1) {
      const textBetweenAtAndCursor = textBeforeCursor.substring(lastAtIdx + 1);
      // Trigger if no space between @ and cursor, and @ is at start or preceded by space
      const isAtTriggered = lastAtIdx === 0 || textBeforeCursor[lastAtIdx - 1] === " " || textBeforeCursor[lastAtIdx - 1] === "\n";

      if (isAtTriggered && !textBetweenAtAndCursor.includes(" ")) {
        setShowMentions(true);
        setMentionQuery(textBetweenAtAndCursor.toLowerCase());
        setMentionIndex(0);
        setMentionStartIndex(lastAtIdx);
        return;
      }
    }

    setShowMentions(false);
    setMentionStartIndex(-1);
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
      if (isComposing) return;
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const selectAgent = (agent: Agent) => {
    if (mentionStartIndex !== -1) {
      const cursor = inputRef.current?.selectionStart || mentionStartIndex + mentionQuery.length + 1;
      const beforeMention = inputValue.substring(0, mentionStartIndex);
      const afterMention = inputValue.substring(cursor);

      const newVal = beforeMention + `@${agent.name} ` + afterMention;
      setInputValue(newVal);

      // Calculate new cursor position
      const newCursorPos = mentionStartIndex + agent.name.length + 2; // +1 for @, +1 for space

      // Set focus and cursor position after state update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }

    setShowMentions(false);
    setMentionStartIndex(-1);
    setMentionQuery("");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const currentInputValue = inputValue.trim();
    const newMessage: Message = {
      id: Date.now().toString(),
      agentId: "user",
      agentName: "You",
      content: currentInputValue,
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

    // Identify all mentioned agents
    const mentionedAgents = agents.filter(a => currentInputValue.includes(`@${a.name}`));

    // Add to history
    setInputHistory(prev => [inputValue, ...prev.filter(h => h !== inputValue)].slice(0, 50));
    setHistoryIndex(-1);
    setInputValue("");

    if (mentionedAgents.length > 0) {
      // Trigger sequential responses for all mentioned agents
      for (const agent of mentionedAgents) {
        const agentIndex = agents.findIndex(a => a.id === agent.id);
        if (agentIndex !== -1) {
          await getNextResponse(activeSessionId, agentIndex);
        }
      }
    } else {
      // Fallback to active agent if none mentioned
      await getNextResponse(activeSessionId);
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
      agents: [],
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
    <main className="h-screen w-full flex overflow-hidden bg-slate-100 p-3 lg:p-4 gap-4 transition-all duration-300">
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
      {sessions.length > 0 && (
        <aside className={cn(
          "w-80 flex flex-col gap-4 z-40 transform transition-all duration-500",
          "fixed inset-y-4 left-4 md:relative md:inset-0",
          isSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 md:translate-x-0 md:opacity-100"
        )}>
          {/* Sessions Section Island */}
          <div className="flex flex-col h-[40%] bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl shadow-blue-900/5 overflow-hidden">
            <div className="h-20 px-6 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/10">
              <h2 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                Chat Rooms
              </h2>
              <button
                onClick={createSession}
                className="p-2 bg-transparent text-gray-400 hover:text-gray-900 transition-all active:scale-90"
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    "p-3 rounded-xl cursor-pointer flex items-center justify-between group text-sm transition-all duration-200 border transform active:scale-[0.97] hover:scale-[1.01]",
                    activeSessionId === session.id
                      ? "bg-white/40 backdrop-blur-sm text-gray-900 shadow-lg shadow-gray-400/20 border-white/60"
                      : "bg-transparent border-transparent hover:border-white/40 hover:shadow-md text-gray-500 hover:text-gray-800"
                  )}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        autoFocus
                        className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-lg px-2 py-1 w-full text-xs outline-none shadow-sm"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSessionName(session.id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={(e) => { e.stopPropagation(); saveSessionName(session.id); }} className="p-1 hover:bg-green-50 rounded-md text-green-600 transition-colors"><Check className="w-3.5 h-3.5" /></button>
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

          {/* Agents Section Island */}
          <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl shadow-blue-900/5 overflow-hidden min-h-0">
            {/* Header */}
            <div className="h-20 px-6 flex justify-between items-center bg-white/20 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10" >
              <h2 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                Agents
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={addAgent}
                  className="p-2 bg-transparent text-gray-400 hover:text-gray-900 transition-all active:scale-90 disabled:opacity-20"
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

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeSession && agents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/60 mb-2">
                    <Bot className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-800">No Agents Yet</p>
                    <p className="text-xs text-gray-500 leading-relaxed">Add agents to start the conversation.</p>
                  </div>
                  <button
                    onClick={addAgent}
                    className="mt-4 px-6 py-2.5 bg-white/60 backdrop-blur-md text-gray-800 text-xs font-extrabold rounded-xl border border-white/80 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Agent
                  </button>
                </div>
              )}
              {activeSession && agents.map((agent) => {
                const isCollapsed = collapsedAgents.has(agent.id);

                return (
                  <div key={agent.id} className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg shadow-blue-900/5 border border-white/60 relative group transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-blue-900/10 hover:scale-[1.02] active:scale-[0.99]">
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
                              className="w-full bg-white border border-white/60 rounded-lg px-2 py-1.5 text-sm outline-none shadow-sm focus:bg-gray-50/50 transition-colors"
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
                                className="w-full bg-white border border-white/60 rounded-lg px-2 py-1.5 text-sm outline-none shadow-sm focus:bg-gray-50/50 transition-colors"
                              />
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Personality</label>
                            <textarea
                              value={agent.systemPrompt}
                              onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                              className="w-full bg-white border border-white/60 rounded-lg p-2 text-xs h-24 outline-none resize-none leading-relaxed shadow-sm focus:bg-gray-50/50 transition-colors"
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
          </div>
        </aside>
      )}

      {/* Main Chat Area */}
      {!activeSession ? (
        <section className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl shadow-blue-900/5 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center shadow-inner">
            <MessageSquare className="w-16 h-16 text-blue-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">No Active Chats</h2>
            <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
              Experience the future of collaboration. Create a room and watch your agents interact in a beautiful, floating arena.
            </p>
          </div>
          <button
            onClick={createSession}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[1.25rem] font-bold shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 group"
          >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
            Create Your First Arena
          </button>
        </section>
      ) : (
        <section className="flex-1 flex flex-col min-w-0 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl shadow-blue-900/5 overflow-hidden" >
          {/* Header */}
          < header className="h-20 bg-white/40 backdrop-blur-md flex items-center justify-between px-6 md:px-8 border-b border-white/40" >
            <div className="flex items-center gap-6 md:gap-8">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg md:hidden"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="font-extrabold text-base text-gray-800 whitespace-nowrap">Chat Arena</h1>
              <div className="flex items-center py-1 ml-4 group/icon-list" onMouseLeave={() => setHoveredAgentIndex(null)}>
                {agents.map((agent, i) => {
                  const isHovered = hoveredAgentIndex === i;
                  const isActive = activeAgentIndex === i;

                  return (
                    <div
                      key={agent.id}
                      onMouseEnter={() => setHoveredAgentIndex(i)}
                      style={{
                        transform: `scale(${isActive ? 1.3 : (isHovered ? 1.15 : 1)})`,
                      }}
                      className={cn(
                        "w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm cursor-default",
                        "transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
                        // Base overlap
                        "mx-[-4px]",
                        // Speaking or Hovered icon gets more space and z-index priority
                        (isActive || isHovered) ? "z-30 mx-1.5" : "z-10",
                        isActive && "ring-2 ring-white/50 shadow-lg",
                        hoveredAgentIndex !== null && !isHovered && "opacity-80",
                        agent.color
                      )}
                      title={agent.name}
                    >
                      {agent.name[0]}
                    </div>
                  );
                })}
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
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold transition-all active:scale-95 disabled:opacity-30",
                  isAutoChatting
                    ? "text-red-500 hover:bg-red-50/50 hover:text-red-600"
                    : "text-blue-600 hover:bg-blue-50/50 hover:text-blue-700"
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
                        "max-w-[80%] shadow-lg p-4 text-gray-800 leading-relaxed whitespace-pre-wrap transition-all",
                        isUser
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-3xl rounded-tr-none shadow-blue-500/20"
                          : "bg-white/90 backdrop-blur-sm rounded-3xl rounded-tl-none border border-white shadow-blue-900/5"
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
          <div className="p-6 bg-gradient-to-t from-gray-50/80 to-transparent relative" >
            {showMentions && filteredAgents.length > 0 && (
              <div
                ref={mentionPopupRef}
                className="absolute bottom-full left-6 mb-1 w-60 bg-white/70 backdrop-blur-xl border border-white/60 rounded-[1.5rem] shadow-2xl overflow-hidden z-20 animate-in fade-in zoom-in-90 slide-in-from-bottom-5 duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
              >
                <div className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400/60 border-b border-white/20">
                  Mention Agent
                </div>
                <div
                  ref={mentionListRef}
                  className="p-1 max-h-[180px] overflow-y-auto no-scrollbar"
                >
                  {filteredAgents.map((agent, i) => (
                    <button
                      key={agent.id}
                      onClick={() => selectAgent(agent)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]",
                        i === mentionIndex
                          ? "bg-white/50 text-gray-900 font-bold shadow-sm"
                          : "text-gray-400 hover:text-gray-600 hover:bg-white/30 shadow-none border-none"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", agent.color)} />
                      <span className="truncate">{agent.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative flex items-end gap-3 bg-white/80 backdrop-blur-md rounded-[1.5rem] px-4 py-2 border border-white/60 shadow-xl shadow-blue-900/5 focus-within:bg-white/95 focus-within:-translate-y-1 focus-within:shadow-2xl focus-within:shadow-blue-500/10 transition-all duration-300">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="Type a message... (Use @ to mention an agent)"
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none resize-none max-h-32 min-h-[36px] py-1.5 px-0 text-sm"
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping[activeSessionId]}
                className={cn(
                  "p-2 bg-transparent rounded-xl transition-all active:scale-90",
                  inputValue.trim()
                    ? "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                    : "text-blue-600 opacity-40",
                  isTyping[activeSessionId] && "opacity-30 cursor-not-allowed"
                )}
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