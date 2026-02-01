"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Save, RotateCcw } from "lucide-react";
import { ApiConfiguration, DEFAULT_API_CONFIG } from "@/types/chat";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfiguration;
  setConfig: (config: ApiConfiguration) => void;
}

export default function SettingsModal({ isOpen, onClose, config, setConfig }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<keyof ApiConfiguration>("openai");
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onClose();
  };

  const updateConfig = (provider: keyof ApiConfiguration, field: "apiKey" | "baseUrl", value: string) => {
    setConfig({
      ...config,
      [provider]: {
        ...config[provider],
        [field]: value
      }
    });
  };

  const resetProvider = (provider: keyof ApiConfiguration) => {
    setConfig({
      ...config,
      [provider]: {
        ...config[provider],
        baseUrl: DEFAULT_API_CONFIG[provider].baseUrl
      }
    });
  };

  const tabs: { id: keyof ApiConfiguration; label: string }[] = [
    { id: "openai", label: "OpenAI" },
    { id: "google", label: "Gemini (Google)" },
    { id: "moonshot", label: "Moonshot (Kimi)" },
    { id: "alibaba", label: "Qwen (Alibaba)" },
    { id: "local", label: "Local / Custom" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4 animate-in fade-in duration-500"
      onClick={onClose}
    >
      <div
        className="bg-white/75 backdrop-blur-xl rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-white/60 overflow-hidden animate-in zoom-in-90 slide-in-from-bottom-20 duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Island */}
        <div className="flex justify-between items-center px-8 py-6">
          <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">API Configuration</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 px-6 pb-4 gap-4">
          {/* Sidebar Tabs Island */}
          <div className="w-40 flex flex-col gap-1 py-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm font-bold rounded-2xl transition-all active:scale-95",
                  activeTab === tab.id
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-1">
            <div className="space-y-6 px-2">
              <div className="flex items-center justify-between ">
                <h3 className="text-lg font-extrabold text-gray-800 tracking-tight capitalize">{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
                <button
                  onClick={() => resetProvider(activeTab)}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">
                    API Key
                  </label>
                  <div className="relative group">
                    <input
                      type={showKey ? "text" : "password"}
                      value={config[activeTab].apiKey}
                      onChange={(e) => updateConfig(activeTab, "apiKey", e.target.value)}
                      placeholder={`sk-...`}
                      className="w-full bg-white/5 rounded-2xl pl-4 pr-12 py-2.5 focus:bg-white/30 focus:-translate-y-0.5 focus:shadow-2xl focus:shadow-blue-500/10 outline-none font-mono text-sm transition-all"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 p-1 transition-colors"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={config[activeTab].baseUrl}
                    onChange={(e) => updateConfig(activeTab, "baseUrl", e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="w-full bg-white/5 rounded-2xl px-4 py-2.5 focus:bg-white/30 focus:-translate-y-0.5 focus:shadow-2xl focus:shadow-blue-500/10 outline-none font-mono text-sm transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/20 space-y-2">
                <p className="font-bold text-[10px] text-gray-400 uppercase tracking-[0.2em]">Supported Models</p>
                <div className="opacity-90 leading-relaxed font-medium text-[11px] text-gray-500">
                  {activeTab === "openai" && <p>gpt-3.5-turbo, gpt-4, gpt-4o</p>}
                  {activeTab === "google" && <p>gemini-pro, gemini-2.5-flash, gemini-1.5-pro</p>}
                  {activeTab === "moonshot" && <p>moonshot-v1-8k</p>}
                  {activeTab === "alibaba" && <p>qwen-turbo, qwen-plus, qwen-max</p>}
                  {activeTab === "local" && (
                    <div className="space-y-1">
                      <p>Ollama, LM Studio, etc.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-400 font-bold hover:text-gray-900 transition-all active:scale-95 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-transparent text-gray-400 font-bold hover:text-gray-900 transition-all active:scale-95 flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}