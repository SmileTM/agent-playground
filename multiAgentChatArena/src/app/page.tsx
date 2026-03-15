"use client";

import { useState, useEffect, useRef } from "react";
import { Agent, Message, ModelProvider, ApiConfiguration, DEFAULT_API_CONFIG, ChatSession } from "@/types/chat";
import { cn } from "@/lib/utils";
import { buildSystemPrompt, formatHistoryForContext } from "@/lib/prompts";
import { createParser } from "eventsource-parser";
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
  ChevronRight,
  Bug,
  Copy,
  Lightbulb,
  Square,
  Target
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

const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({}); // agentId -> isTyping
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
  const [openDebugIds, setOpenDebugIds] = useState<Set<string>>(new Set());
  const [openThinkIds, setOpenThinkIds] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const userScrolledUpRef = useRef(false);
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

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

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

  // Track user scroll intent via wheel event (only fires on real user interaction, not programmatic scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // User scrolling up -> lock scroll position
      if (e.deltaY < 0) {
        userScrolledUpRef.current = true;
      }
      // User scrolling down near the bottom -> unlock
      if (e.deltaY > 0) {
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom < 100) {
          userScrolledUpRef.current = false;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Auto-scroll to bottom (respects user scroll intent)
  useEffect(() => {
    if (scrollRef.current && !userScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
        // Prevent adding duplicate message IDs
        if (s.messages.some(m => m.id === message.id)) return s;
        return { ...s, messages: [...s.messages, message] };
      }
      return s;
    }));
  };



  const getNextResponse = async (sessionId: string, agentIndex: number, historyOverride?: Message[]): Promise<Message | null> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.agents.length === 0) return null;

    const currentAgent = session.agents[agentIndex];
    const agentId = currentAgent.id;

    setIsTyping(prev => ({ ...prev, [agentId]: true }));

    // Helper to process chunks and update state (used by both local and remote)
    let rawContent = "";
    let nativeReasoning = "";

    const processChunk = (parsed: any) => {
      if (parsed.type === "debug") {
        setSessions(prev => {
          const sessionIndex = prev.findIndex(s => s.id === sessionId);
          if (sessionIndex === -1) return prev;
          const newSessions = [...prev];
          const newSession = { ...newSessions[sessionIndex] };
          const messageIndex = newSession.messages.findIndex(m => m.id === newMessageId);
          if (messageIndex === -1) return prev;
          newSession.messages = [...newSession.messages];
          newSession.messages[messageIndex] = { 
            ...newSession.messages[messageIndex], 
            debugInfo: { promptPayload: parsed.promptPayload, rawResponse: [] } 
          };
          newSessions[sessionIndex] = newSession;
          return newSessions;
        });
      } else if (parsed.type === "chunk") {
        const chunkText = parsed.content || "";
        const reasoning = parsed.reasoning || "";

        if (reasoning) nativeReasoning += reasoning;
        if (chunkText) rawContent += chunkText;

        setSessions(prev => {
          const sessionIndex = prev.findIndex(s => s.id === sessionId);
          if (sessionIndex === -1) return prev;

          const newSessions = [...prev];
          const newSession = { ...newSessions[sessionIndex] };
          const messageIndex = newSession.messages.findIndex(m => m.id === newMessageId);
          if (messageIndex === -1) return prev;

          const updatedMessage = { ...newSession.messages[messageIndex] };
          
          // Update debug
          if (updatedMessage.debugInfo && parsed.raw) {
            updatedMessage.debugInfo.rawResponse.push(parsed.raw);
          }

          // Track thinking state
          if ((reasoning || chunkText.includes("<think>")) && !updatedMessage.thinkStartTime) {
            updatedMessage.isThinking = true;
            updatedMessage.thinkStartTime = Date.now();
          }

          // Logic to parse <think> tags from the raw sequence
          const thinkMatch = rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
          if (thinkMatch) {
            const extractedThink = thinkMatch[1];
            const replacedContent = rawContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
            
            updatedMessage.content = replacedContent;
            updatedMessage.thinkContent = nativeReasoning + extractedThink.trim();

            if (rawContent.includes("</think>")) {
              updatedMessage.isThinking = false;
              updatedMessage.thinkDurationMs = Date.now() - (updatedMessage.thinkStartTime || Date.now());
            }
          } else {
            // If we're "thinking" but there's no tag in rawContent yet, we're likely in native reasoning
            updatedMessage.content = rawContent;
            updatedMessage.thinkContent = nativeReasoning;

            if (updatedMessage.isThinking && !reasoning && chunkText.trim().length > 0 && !chunkText.includes("<think>")) {
              updatedMessage.isThinking = false;
              updatedMessage.thinkDurationMs = Date.now() - (updatedMessage.thinkStartTime || Date.now());
            }
          }

          newSession.messages = [...newSession.messages];
          newSession.messages[messageIndex] = updatedMessage;
          newSessions[sessionIndex] = newSession;
          return newSessions;
        });

        if (reasoning || (chunkText && chunkText.includes("<think>"))) {
          setOpenThinkIds(prev => new Set(prev).add(newMessageId));
        }
      }
    };

    // Cancel previous request for THIS agent if any
    if (abortControllersRef.current.has(agentId)) {
      abortControllersRef.current.get(agentId)?.abort();
    }

    // Create a per-agent abort controller
    const controller = new AbortController();
    abortControllersRef.current.set(agentId, controller);

    let newMessageId = generateId('msg');
    let newMessage: Message = {
      id: newMessageId,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      content: "",
      thinkContent: "",
      timestamp: Date.now(),
      debugInfo: null,
      isThinking: true,
      thinkStartTime: Date.now(),
    };

    // Auto-expand the thought process for a live-streaming feel
    setOpenThinkIds(prev => new Set(prev).add(newMessageId));

    // Explicitly add an empty message to state first so the UI renders it
    addMessageToSession(sessionId, newMessage);

    try {
      // The controller is already created and set in abortControllersRef.current at the start of the function
      const controller = abortControllersRef.current.get(agentId)!;

      const model = currentAgent.model || "gpt-3.5-turbo";

      let response: Response;

      if (model === "local") {
        // Direct FETCH for local models (to avoid server-side localhost issues when deployed)
        const baseUrl = apiConfig.local.baseUrl.replace(/\/+$/, "");
        const apiKey = apiConfig.local.apiKey;
        const endpoint = `${baseUrl}/chat/completions`;

        const jsonHistory = formatHistoryForContext(historyOverride || session.messages, currentAgent.id);
        const systemMessageContent = buildSystemPrompt({
          currentAgent,
          allAgents: session.agents,
          systemBasePrompt: session.systemBasePrompt,
        });

        const latestMessageContent = (historyOverride || session.messages)[(historyOverride || session.messages).length - 1]?.content || "(continues)";
        let finalUserContent = latestMessageContent;
        if (jsonHistory.length > 0) {
          const historyBlock = `Chat history since last reply (untrusted, for context):\n\`\`\`json\n${JSON.stringify(jsonHistory, null, 2)}\n\`\`\`\n\n`;
          finalUserContent = historyBlock + latestMessageContent;
        }

        const payload = {
          model: currentAgent.localModelName || "qwen/qwen3-vl-8b",
          messages: [
            { role: "system", content: systemMessageContent },
            { role: "user", content: finalUserContent }
          ],
          stream: true,
        };

        console.log(`[LOCAL] Direct calling at ${endpoint}`);
        
        // Add debug info for consistent UI display
        processChunk({ type: "debug", promptPayload: payload });

        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } else {
        // Server-side proxy for other models
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historyOverride || session.messages,
            currentAgent,
            allAgents: session.agents,
            systemBasePrompt: session.systemBasePrompt,
            apiConfig,
          }),
        });
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (model === "local") {
        const parser = createParser({
          onEvent(event) {
            const dataStr = event.data;
            if (dataStr === '[DONE]') return;
            try {
              const dataObj = JSON.parse(dataStr);
              const content = dataObj.choices?.[0]?.delta?.content || "";
              const reasoning = dataObj.choices?.[0]?.delta?.reasoning_content || "";
              
              if (content || reasoning) {
                processChunk({ type: "chunk", content, reasoning, raw: dataObj });
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
      } else {
        // Handle server NDJSON
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          while (true) {
            const boundary = buffer.indexOf("\n");
            if (boundary === -1) break;

            const line = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 1);

            if (!line) continue;

            try {
              const parsed = JSON.parse(line);
              processChunk(parsed);
            } catch (e) {
              buffer = line + "\n" + buffer;
              break; 
            }
          }
        }
      }

      // Need to get the final state of the message to return accurately
      // But we can approximate it with our local accumulators
      const finalThinkMatch = rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
      const finalContent = finalThinkMatch 
        ? rawContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
        : rawContent;
      const finalThinkContent = nativeReasoning + (finalThinkMatch ? finalThinkMatch[1].trim() : "");

      return {
        ...newMessage,
        content: finalContent,
        thinkContent: finalThinkContent,
        isThinking: false,
        thinkDurationMs: Date.now() - (newMessage.thinkStartTime || Date.now())
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`Generation for ${currentAgent.name} stopped by user.`);
        // Finalize message state if it was thinking
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.id === newMessageId && m.isThinking) {
                return { 
                  ...m, 
                  isThinking: false, 
                  thinkDurationMs: Date.now() - (m.thinkStartTime || Date.now()) 
                };
              }
              return m;
            })
          };
        }));
      } else {
        console.error(`Failed to get response for ${currentAgent.name}:`, error);
        // Show error message in the bubble
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.id === newMessageId) {
                return { 
                  ...m, 
                  isThinking: false, 
                  content: `Error: ${error.message || "Failed to fetch response"}` 
                };
              }
              return m;
            })
          };
        }));
      }
      return null;
    } finally {
      setIsTyping(prev => ({ ...prev, [agentId]: false }));
      abortControllersRef.current.delete(agentId);
    }
  };

  const handleStopGeneration = () => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    updateActiveSession({ isAutoChatting: false });
    setIsTyping({});
  };

  useEffect(() => {
    // Check ALL sessions for auto-chat
    const timers: NodeJS.Timeout[] = [];

    /* 
    sessions.forEach(session => {
      if (session.isAutoChatting && !isTyping[session.id]) {
        const timer = setTimeout(() => {
          getNextResponse(session.id);
        }, 2000);
        timers.push(timer);
      }
    });
    */

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
      id: generateId('msg'),
      agentId: "user",
      agentName: "You",
      content: currentInputValue,
      timestamp: Date.now(),
      isUser: true,
    };

    const updatedMessages = [...messages, newMessage];

    // Force scroll to bottom when user sends a message
    userScrolledUpRef.current = false;
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    }

    // Optimistic update
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: updatedMessages };
      }
      return s;
    }));

    // Add to input history
    setInputHistory(prev => [inputValue, ...prev.filter(h => h !== inputValue)].slice(0, 50));
    setHistoryIndex(-1);
    setInputValue("");

    // --- ORCHESTRATION LOGIC (Parallel with Input Isolation) ---
    const initialMentions = agents
      .map((a, index) => (currentInputValue.includes(`@${a.name}`) ? index : -1))
      .filter(index => index !== -1);

    if (initialMentions.length === 0) return;

    let currentHistory = updatedMessages;
    let depth = 0;
    const maxDepth = 5;
    let currentRoundAgentIndices = initialMentions;

    while (currentRoundAgentIndices.length > 0 && depth < maxDepth) {
      // Input Isolation: All agents in the same round see the SAME history
      const historyForThisRound = [...currentHistory];
      
      // Execute all mentioned agents in parallel
      const responses = await Promise.all(
        currentRoundAgentIndices.map(agentIndex => 
          getNextResponse(activeSessionId, agentIndex, historyForThisRound)
        )
      );

      // Filter out failed responses and update history for next round
      const validResponses = responses.filter((r): r is Message => r !== null && !!r.content);
      if (validResponses.length === 0) break;

      currentHistory = [...currentHistory, ...validResponses];
      depth++;

      // Chain reaction: scan all NEW responses for NEW @Mentions
      const nextRoundAgentIndices: number[] = [];
      validResponses.forEach(res => {
        agents.forEach((a, aIdx) => {
          // Trigger if mentioned, not mentioning itself, and not already in this round's results
          if (res.content.includes(`@${a.name}`) && a.id !== res.agentId) {
            if (!nextRoundAgentIndices.includes(aIdx)) {
              nextRoundAgentIndices.push(aIdx);
            }
          }
        });
      });

      currentRoundAgentIndices = nextRoundAgentIndices;
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
      id: generateId('agent'),
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
      id: generateId('sess'),
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
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startEditingSession(session.id, session.name, e)}
                          className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
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

          {/* System Base Prompt Island */}
          {activeSession && (
            <div className="flex flex-col bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-white/60 shadow-xl shadow-purple-900/5 p-4 shrink-0 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <h3 className="font-extrabold text-sm text-gray-800">System Prompt</h3>
              </div>
              <textarea
                value={activeSession.systemBasePrompt || ""}
                onChange={(e) => updateActiveSession({ systemBasePrompt: e.target.value })}
                placeholder="Enter global task or context (e.g., 'Discuss AI ethics')"
                className="w-full bg-white/50 border border-white/60 rounded-xl p-2 text-xs h-16 outline-none resize-none leading-relaxed shadow-sm focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all text-gray-700 placeholder:text-gray-400"
              />
            </div>
          )}

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
                          {agent.name?.[0] ? agent.name[0].toUpperCase() : '?'}
                        </div>
                        <span className="flex-1 font-medium text-sm truncate select-none text-gray-700">
                          {agent.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAgent(agent.id);
                          }}
                          className="p-1 text-gray-500 hover:text-gray-800 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
                          title="Remove Agent"
                        >
                          <Trash2 className="w-3 h-3" />
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
                            className="p-1 text-gray-500 hover:text-gray-800 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
                            title="Remove Agent"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Profile Section (Center) */}
                        <div className="flex flex-col items-center gap-3">
                          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md", agent.color)}>
                            {agent.name?.[0] ? agent.name[0].toUpperCase() : '?'}
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
      )
      }

      {/* Main Chat Area */}
      {
        !activeSession ? (
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
              <div className="flex items-center gap-4 md:gap-8 min-w-0 flex-1">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-lg md:hidden"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="font-extrabold text-base text-gray-800 whitespace-nowrap">Chat Arena</h1>
                <div className="flex items-center py-2 ml-2 md:ml-4 group/icon-list overflow-x-auto no-scrollbar" onMouseLeave={() => setHoveredAgentIndex(null)}>
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
                        {agent.name?.[0] || '?'}
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
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span className="hidden md:inline">Start Auto-Chat</span>
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
                messages.length === 0 && !Object.values(isTyping).some(Boolean) && (
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
                        {/* Think Content Block */}
                        {(msg.thinkContent || msg.isThinking) && !isUser && (
                          <div className="mb-3">
                            <button
                              onClick={() => {
                                setOpenThinkIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(msg.id)) newSet.delete(msg.id);
                                  else newSet.add(msg.id);
                                  return newSet;
                                });
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer w-fit border shadow-sm",
                                msg.isThinking 
                                  ? "bg-blue-50/50 border-blue-100 text-blue-600 animate-pulse-subtle" 
                                  : "bg-gray-100/50 border-gray-100 text-gray-500 hover:bg-gray-100"
                              )}
                            >
                              {msg.isThinking ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", openThinkIds.has(msg.id) ? "" : "-rotate-90")} />
                              )}
                              <span>
                                {msg.isThinking 
                                  ? `Thinking... (${Math.round((Date.now() - (msg.thinkStartTime || Date.now())) / 1000)}s)` 
                                  : `Thought for ${msg.thinkDurationMs ? Math.round(msg.thinkDurationMs / 1000) : '?'}s`}
                              </span>
                            </button>
                            
                            {(openThinkIds.has(msg.id) || msg.isThinking) && msg.thinkContent && (
                              <div className="mt-2 p-3 bg-gray-50/40 rounded-2xl border border-gray-100/50 text-sm text-gray-500 italic shadow-inner whitespace-pre-wrap overflow-hidden animate-in slide-in-from-top-1 duration-200">
                                {msg.thinkContent}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.content}
                        {!isUser && isTyping[msg.agentId] && !msg.content.endsWith("...") && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400/50 animate-pulse rounded-full align-middle" />
                        )}
                      </div>

                      {msg.debugInfo && !isUser && (
                        <div className="mt-2 w-full max-w-[80%] flex flex-col items-start">
                          <button
                            onClick={() => {
                              setOpenDebugIds(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(msg.id)) newSet.delete(msg.id);
                                else newSet.add(msg.id);
                                return newSet;
                              });
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 hover:bg-black/5 rounded-md text-[10px] text-gray-400 font-medium transition-colors cursor-pointer"
                          >
                            <Bug className="w-3 h-3" />
                            {openDebugIds.has(msg.id) ? 'Hide trace' : 'View trace'}
                          </button>
                          
                          {openDebugIds.has(msg.id) && (
                            <div className="mt-2 w-full p-4 bg-gray-900 rounded-xl overflow-x-auto text-[11px] font-mono text-gray-300 shadow-inner select-text relative group/trace space-y-4">
                              
                              {/* Request Payload */}
                              <div className="relative group/req">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-blue-400 font-bold tracking-wide">Request Payload:</div>
                                  <button
                                    onClick={() => handleCopy(JSON.stringify(msg.debugInfo.promptPayload, null, 2), `${msg.id}-req`)}
                                    className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white flex items-center gap-1"
                                  >
                                    {copiedKey === `${msg.id}-req` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    <span className="text-[9px]">{copiedKey === `${msg.id}-req` ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                                <pre className="whitespace-pre-wrap break-all bg-black/40 p-3 rounded-lg border border-white/5 select-text overflow-x-auto selection:bg-blue-500/40 selection:text-white">
                                  {JSON.stringify(msg.debugInfo.promptPayload, null, 2)}
                                </pre>
                              </div>

                              <div className="h-px bg-white/10 w-full" />
                              
                              {/* Raw Response */}
                              <div className="relative group/res">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-green-400 font-bold tracking-wide">Raw Response:</div>
                                  <button
                                    onClick={() => handleCopy(JSON.stringify(msg.debugInfo.rawResponse, null, 2), `${msg.id}-res`)}
                                    className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white flex items-center gap-1"
                                  >
                                    {copiedKey === `${msg.id}-res` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    <span className="text-[9px]">{copiedKey === `${msg.id}-res` ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                                <pre className="whitespace-pre-wrap break-all bg-black/40 p-3 rounded-lg border border-white/5 select-text overflow-x-auto selection:bg-green-500/40 selection:text-white">
                                  {JSON.stringify(msg.debugInfo.rawResponse, null, 2)}
                                </pre>
                              </div>

                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              }

              {/* The "is responding" bubbles are now merged into the message bubbles above */}
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
                
                {Object.values(isTyping).some(Boolean) ? (
                  <button
                    onClick={handleStopGeneration}
                    className="p-2 bg-red-50 text-red-500 rounded-xl transition-all active:scale-90 hover:bg-red-100"
                    title="Stop Generating"
                  >
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className={cn(
                      "p-2 bg-transparent rounded-xl transition-all active:scale-90",
                      inputValue.trim()
                        ? "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        : "text-blue-600 opacity-40"
                    )}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="text-[10px] text-gray-400 mt-2 text-center">
                Use <strong>@AgentName</strong> to force a reply from a specific agent.
              </div>
            </div >
          </section >
        )
      }
    </main >
  );
}