import React, { useState, useEffect } from 'react';
import { Sparkles, Key, CheckCircle2, AlertCircle, X, Shield, Cpu, RefreshCw, Smile, Check } from 'lucide-react';
import { configMistralKey } from '../services/api';
import { PERSONALITIES, getPersonalityIcon } from './PersonalityModal';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onKeyUpdated, 
  backendStatus,
  currentPersonality = 'enthusiastic',
  onSelectPersonality
}) {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isConfigured, setIsConfigured] = useState(backendStatus?.mistral_configured || false);

  useEffect(() => {
    if (isOpen) {
      configMistralKey().then(res => {
        setIsConfigured(res.mistral_configured);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await configMistralKey(apiKey);
      setIsConfigured(res.mistral_configured);
      setStatusMessage({ type: 'success', text: res.message || 'Mistral key updated successfully!' });
      if (onKeyUpdated) onKeyUpdated(res.mistral_configured);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update key' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card-elevated max-w-lg w-full p-6 rounded-3xl border border-slate-200/80 space-y-5 shadow-2xl animate-slide-up my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Outfit']">Lumi AI Configuration</h3>
              <p className="text-[11px] text-slate-500">Mistral API + Heuristic Offline Fallback Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Card */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
          isConfigured
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 shadow-sm'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-2.5">
            {isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <div>
              <div className="font-bold text-slate-900">
                {isConfigured ? 'Mistral AI Connected & Active' : 'Smart Offline Heuristic Engine Active'}
              </div>
              <div className="text-[11px] text-slate-500">
                {isConfigured
                  ? 'Real-time Mistral Small responses enabled for conversational habit guidance.'
                  : 'Operating in offline mode with deterministic schedule math & built-in heuristic responses.'}
              </div>
            </div>
          </div>
        </div>

        {/* Personality Switcher Row in Settings */}
        {onSelectPersonality && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-purple-600" />
              <span>Active Companion Persona</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITIES.map((p) => {
                const isSelected = currentPersonality === p.id;
                const Icon = getPersonalityIcon(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPersonality(p.id)}
                    className={`p-2.5 rounded-2xl border text-left transition flex items-center gap-2 text-xs ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold ring-1 ring-purple-500 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="truncate">{p.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Key Form */}
        <form onSubmit={handleSaveKey} className="space-y-3.5 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-600" />
              <span>Mistral API Key (Optional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? "••••••••••••••••••••••••••••" : "Paste your Mistral API key (optional)"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white focus:ring-1 focus:ring-purple-500 text-xs text-slate-900 placeholder-slate-400 outline-none font-mono"
            />
          </div>

          {statusMessage && (
            <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
              statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3.5 py-2 text-slate-500 hover:text-slate-800 transition font-medium rounded-xl hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-40"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              <span>{apiKey.trim() ? "Save & Connect" : "Verify Status"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
