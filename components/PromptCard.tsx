import React, { useState, useMemo } from 'react';
import { PromptItem } from '../types';
import { IconCopy, IconEdit, IconRefresh, IconCheck } from './Icons';
import { refineSinglePrompt } from '../services/geminiService';

interface PromptCardProps {
  prompt: PromptItem;
  onUpdate: (id: string, newText: string) => void;
  onToggleCopy: (id: string) => void;
  isCopied: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ prompt, onUpdate, onToggleCopy, isCopied }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.text);
  const [isRefining, setIsRefining] = useState(false);

  // Try to parse JSON for cleaner display
  const parsedContent = useMemo(() => {
    try {
      return JSON.parse(prompt.text);
    } catch (e) {
      return null;
    }
  }, [prompt.text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.text);
    onToggleCopy(prompt.id);
  };

  const handleRefine = async () => {
    setIsRefining(true);
    const newText = await refineSinglePrompt(prompt.text, "Make this prompt more detailed and specific.");
    onUpdate(prompt.id, newText);
    setEditText(newText);
    setIsRefining(false);
  };

  const saveEdit = () => {
    onUpdate(prompt.id, editText);
    setIsEditing(false);
  };

  // Badge extraction
  const shotType = parsedContent?.photography?.shot_type;
  const expression = parsedContent?.subject?.expression;
  const setting = parsedContent?.background?.setting;
  const meta = prompt.generationMeta;

  return (
    <div className={`group relative bg-charcoal border rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-black/40 ${
      isCopied 
        ? 'border-green-500/50 ring-2 ring-green-500/30 bg-green-900/5' 
        : 'border-graphite hover:border-gray-500'
    }`}>
      
      {/* Copied Overlay */}
      {isCopied && (
        <div className="absolute inset-0 bg-green-500/5 rounded-xl pointer-events-none transition-colors duration-300" />
      )}

      {/* Header Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3 relative z-10">
        
        {/* GENERATION METADATA BADGE (New) */}
        {meta && (
            <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-900/50 rounded px-2 py-0.5">
                <span className="text-xs font-bold text-blue-300 tracking-wider font-mono">
                    {meta.type}
                </span>
                <span className="w-px h-3 bg-blue-800"></span>
                <span className="text-[10px] text-blue-200 font-mono">
                    {meta.index} / {meta.total}
                </span>
                <span className="w-px h-3 bg-blue-800"></span>
                <span className="text-[10px] text-blue-400 truncate max-w-[120px]">
                    {meta.label}
                </span>
            </div>
        )}

        {/* Fallback Shot Type Badge */}
        {!meta && shotType && (
            <span className="px-2 py-0.5 text-xs font-mono text-gray-400 border border-gray-800 bg-gray-800/30 rounded">
                {shotType}
            </span>
        )}

        {expression && (
            <span className="px-2 py-0.5 text-xs font-mono text-purple-300 border border-purple-900 bg-purple-900/20 rounded truncate max-w-[150px]">
                {expression}
            </span>
        )}
      </div>

      {/* Content */}
      <div className="min-h-[60px] relative z-10">
        {isEditing ? (
          <textarea 
            className="w-full bg-black/30 text-gray-200 p-2 rounded border border-gray-700 focus:border-accent outline-none text-xs font-mono leading-relaxed"
            rows={10}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            autoFocus
          />
        ) : (
          parsedContent ? (
             <div className="text-xs font-mono text-gray-300 space-y-2">
                 {parsedContent.subject?.description && (
                     <p className="text-white font-bold mb-2">"{parsedContent.subject.description}"</p>
                 )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/20 p-2 rounded border border-white/5">
                        <span className="text-gray-500 block mb-1">Subject</span>
                        <pre className="whitespace-pre-wrap text-gray-400">{JSON.stringify(parsedContent.subject, null, 2)}</pre>
                    </div>
                    <div className="space-y-2">
                        <div className="bg-black/20 p-2 rounded border border-white/5">
                            <span className="text-gray-500 block mb-1">Clothing</span>
                            <pre className="whitespace-pre-wrap text-gray-400">{JSON.stringify(parsedContent.subject?.clothing, null, 2)}</pre>
                        </div>
                        <div className="bg-black/20 p-2 rounded border border-white/5">
                            <span className="text-gray-500 block mb-1">Background</span>
                            <pre className="whitespace-pre-wrap text-gray-400">{JSON.stringify(parsedContent.background, null, 2)}</pre>
                        </div>
                    </div>
                 </div>
                 <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-[10px] text-gray-600">Raw JSON available on copy or edit</p>
                 </div>
             </div>
          ) : (
            <p className="text-gray-200 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                {prompt.text}
            </p>
          )
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
        <div className="flex gap-1 text-xs text-gray-500 font-mono overflow-hidden">
          {prompt.tags.slice(0, 3).map(t => `#${t}`).join(' ')}
        </div>
        
        <div className="flex gap-2">
           <button 
            onClick={handleRefine}
            disabled={isRefining}
            className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-800 rounded transition-colors"
            title="Auto-Refine (Expand)"
          >
            <IconRefresh className={`w-4 h-4 ${isRefining ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-800 rounded transition-colors"
            title="Edit"
          >
            <IconEdit className="w-4 h-4" />
          </button>
          <button 
            onClick={handleCopy}
            className={`p-1.5 rounded transition-all duration-300 ${
                isCopied 
                ? 'text-green-500 bg-green-900/30 scale-110' 
                : 'text-gray-400 hover:text-green-400 hover:bg-gray-800'
            }`}
            title="Copy"
          >
            {isCopied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};