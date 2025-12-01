
import React, { useState, useMemo } from 'react';
import { PromptItem } from '../types';
import { IconCopy, IconEdit, IconCheck, IconSettings } from './Icons';

interface PromptCardProps {
  prompt: PromptItem;
  onUpdate: (id: string, newText: string) => void;
  onToggleCopy: (id: string) => void;
  isCopied: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ prompt, onUpdate, onToggleCopy, isCopied }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Robust JSON Parsing
  const parsedContent = useMemo(() => {
    try {
      const cleaned = prompt.text.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }, [prompt.text]);

  const finalString = parsedContent?.generation_data?.final_prompt_string || prompt.text;
  const refLogic = parsedContent?.generation_data?.reference_logic;

  const handleCopy = () => {
    navigator.clipboard.writeText(finalString);
    onToggleCopy(prompt.id);
  };

  const saveEdit = () => {
    // We only allow editing the final string for now to keep JSON integrity
    if (parsedContent && parsedContent.generation_data) {
        parsedContent.generation_data.final_prompt_string = editText;
        onUpdate(prompt.id, JSON.stringify(parsedContent));
    } else {
        onUpdate(prompt.id, editText);
    }
    setIsEditing(false);
  };

  const startEdit = () => {
      setEditText(finalString);
      setIsEditing(true);
  }

  const meta = prompt.generationMeta;

  return (
    <div className={`group relative bg-charcoal border rounded-xl p-0 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/60 ${
      isCopied 
        ? 'border-green-500/50 ring-1 ring-green-500/30' 
        : 'border-gray-800 hover:border-gray-600'
    }`}>
      
      {isCopied && <div className="absolute inset-0 bg-green-500/5 pointer-events-none z-0" />}

      {/* HEADER BAR */}
      <div className="bg-black/40 p-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 relative z-10">
         <div className="flex items-center gap-2">
            {meta ? (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
                    <span className="text-[10px] font-bold text-blue-400 font-mono uppercase">{meta.type}</span>
                    <span className="w-px h-3 bg-blue-500/20"></span>
                    <span className="text-[10px] text-blue-300 font-mono">{meta.index} / {meta.total}</span>
                </div>
            ) : null}
            
            {meta?.label && (
                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px] hidden sm:block">
                    {meta.label}
                </span>
            )}
         </div>

         <div className="flex gap-2">
            <button 
                onClick={handleCopy}
                className={`p-1.5 rounded-lg transition-all ${isCopied ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
                {isCopied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
            </button>
            <button onClick={startEdit} className="p-1.5 bg-gray-800 text-gray-400 rounded-lg hover:text-white hover:bg-gray-700">
                <IconEdit className="w-4 h-4" />
            </button>
         </div>
      </div>

      {/* CONTENT AREA */}
      <div className="p-4 relative z-10">
        {isEditing ? (
          <textarea 
            className="w-full h-64 bg-black/50 text-gray-200 p-4 rounded-lg border border-gray-700 focus:border-musaicPurple outline-none text-xs font-mono leading-relaxed resize-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            autoFocus
          />
        ) : (
             <div className="space-y-4">
                 {/* Main Dense Prompt */}
                 <div className="bg-black/30 p-4 rounded-lg border border-white/5 font-mono text-xs text-green-400/90 leading-relaxed break-words shadow-inner">
                     {finalString}
                 </div>

                 {/* Reference Logic Badge */}
                 {refLogic && (
                     <div className="flex gap-2">
                         <div className="flex items-center gap-2 px-2 py-1 bg-amber-900/10 border border-amber-500/20 rounded">
                             <IconSettings className="w-3 h-3 text-amber-500" />
                             <span className="text-[9px] text-amber-200 font-mono">
                                REF: {refLogic.primary_ref} / {refLogic.secondary_ref}
                             </span>
                         </div>
                     </div>
                 )}
             </div>
        )}
      </div>
    </div>
  );
};
