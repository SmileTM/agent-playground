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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">API Configuration</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50 border-r overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm font-medium transition-colors border-l-4",
                  activeTab === tab.id
                    ? "bg-white border-blue-600 text-blue-700 shadow-sm"
                    : "border-transparent text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold capitalize">{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
                <button
                  onClick={() => resetProvider(activeTab)}
                  className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  title="Reset Base URL to default"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Default URL
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={config[activeTab].apiKey}
                      onChange={(e) => updateConfig(activeTab, "apiKey", e.target.value)}
                      placeholder={`sk-...`}
                      className="w-full border rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Required for real responses.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={config[activeTab].baseUrl}
                    onChange={(e) => updateConfig(activeTab, "baseUrl", e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The endpoint compatible with OpenAI's /chat/completions format.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-1">Supported Models:</p>
                {activeTab === "openai" && <ul className="list-disc list-inside opacity-80"><li>gpt-3.5-turbo</li><li>gpt-4</li></ul>}
                {activeTab === "google" && <ul className="list-disc list-inside opacity-80"><li>gemini-pro</li><li>gemini-2.5-flash</li></ul>}
                {activeTab === "moonshot" && <ul className="list-disc list-inside opacity-80"><li>moonshot-v1-8k</li></ul>}
                {activeTab === "alibaba" && <ul className="list-disc list-inside opacity-80"><li>qwen-turbo</li></ul>}
                {activeTab === "local" && (
                  <div>
                    <p className="mb-1">Universal endpoint for:</p>
                    <ul className="list-disc list-inside opacity-80 text-xs">
                      <li>Ollama / LM Studio</li>
                      <li>Any OpenAI-compatible API</li>
                      <li>Custom model names per agent</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}