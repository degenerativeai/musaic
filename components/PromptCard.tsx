import React, { useState, useMemo } from 'react';
import { PromptItem } from '../types';
import { IconCopy, IconEdit, IconRefresh, IconCheck, IconUser, IconSettings } from './Icons';
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

  // Robust JSON Parsing
  const parsedContent = useMemo(() => {
    try {
      // 1. Try direct parse
      return JSON.parse(prompt.text);
    } catch (e) {
      try {
        // 2. Try stripping markdown code blocks
        const cleaned = prompt.text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e2) {
        // 3. Fail gracefully to null (Show raw text view)
        return null;
      }
    }
  }, [prompt.text]);

  const handleCopy = () => {
    // If we have parsed content, copy the prettified version, otherwise raw
    const textToCopy = parsedContent ? JSON.stringify(parsedContent, null, 2) : prompt.text;
    navigator.clipboard.writeText(textToCopy);
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
  const meta = prompt.generationMeta;

  // --- Helper Components for the Panes ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SectionHeader = ({ title, colorClass, icon }: any) => (
      <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${colorClass} border-opacity-20`}>
          {icon}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass} brightness-125`}>{title}</span>
      </div>
  );

  const KeyVal = ({ label, val }: { label: string, val: string }) => (
      val ? (
        <div className="mb-1">
            <span className="text-[10px] text-gray-500 mr-2 uppercase">{label}:</span>
            <span className="text-xs text-gray-300 font-medium">{val}</span>
        </div>
      ) : null
  );

  // Helper to render clothing item safely regardless of keys used (type/style/item)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ClothingItem = ({ label, item }: { label: string, item: any }) => {
      let content = <span className="text-gray-500 italic text-[10px]">Not visible / Not specified</span>;

      if (item && Object.keys(item).length > 0) {
          if (typeof item === 'string') {
              content = <span className="text-xs text-gray-300">{item}</span>;
          } else {
              // Check for various keys the AI might use
              const type = item.type || item.style || item.item || item.name || "Garment";
              const color = item.color || "";
              const details = item.details || "";
              
              content = (
                  <div className="flex flex-col">
                     <span className="text-xs text-gray-200 font-medium">
                        {color} {type}
                     </span>
                     {details && (
                         <span className="text-[9px] text-gray-500 leading-tight mt-0.5">{details}</span>
                     )}
                  </div>
              );
          }
      }

      return (
          <div className="mb-2">
              <span className={`text-[10px] uppercase font-bold text-rose-300/70 block mb-0.5`}>{label}</span>
              {content}
          </div>
      );
  };

  return (
    <div className={`group relative bg-charcoal border rounded-xl p-0 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/60 ${
      isCopied 
        ? 'border-green-500/50 ring-1 ring-green-500/30' 
        : 'border-gray-800 hover:border-gray-600'
    }`}>
      
      {/* Copied Overlay */}
      {isCopied && (
        <div className="absolute inset-0 bg-green-500/5 pointer-events-none z-0" />
      )}

      {/* HEADER BAR */}
      <div className="bg-black/40 p-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 relative z-10">
         <div className="flex items-center gap-2">
            {/* Meta Badge */}
            {meta ? (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
                    <span className="text-[10px] font-bold text-blue-400 font-mono uppercase">{meta.type}</span>
                    <span className="w-px h-3 bg-blue-500/20"></span>
                    <span className="text-[10px] text-blue-300 font-mono">{meta.index} / {meta.total}</span>
                </div>
            ) : (
                shotType && <span className="text-[10px] font-mono text-gray-400 border border-gray-700 px-2 py-1 rounded">{shotType}</span>
            )}
            
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
            <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 bg-gray-800 text-gray-400 rounded-lg hover:text-white hover:bg-gray-700">
                <IconEdit className="w-4 h-4" />
            </button>
         </div>
      </div>

      {/* CONTENT AREA */}
      <div className="p-4 relative z-10">
        {isEditing ? (
          <textarea 
            className="w-full h-96 bg-black/50 text-gray-200 p-4 rounded-lg border border-gray-700 focus:border-musaicPurple outline-none text-xs font-mono leading-relaxed resize-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            autoFocus
          />
        ) : (
          parsedContent ? (
             <div className="space-y-4">
                 
                 {/* Main Description (The "Story") */}
                 <div className="bg-gradient-to-br from-gray-800/30 to-black/30 p-3 rounded-lg border border-white/5">
                     <p className="text-sm text-gray-200 font-medium leading-relaxed italic">
                         "{parsedContent.subject?.description || "No description available"}"
                     </p>
                 </div>

                 {/* THE MULTI-PANE GRID */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* Pane 1: Subject & Identity (Purple/Blue) */}
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-3">
                        <SectionHeader 
                            title="Subject Identity" 
                            colorClass="text-indigo-400 border-indigo-500"
                            icon={<IconUser className="w-3 h-3 text-indigo-400" />} 
                        />
                        <div className="space-y-1">
                            <KeyVal label="Age" val={parsedContent.subject?.age} />
                            <KeyVal label="Expression" val={parsedContent.subject?.expression} />
                            <KeyVal label="Hair" val={`${parsedContent.subject?.hair?.color || ''}, ${parsedContent.subject?.hair?.style || ''}`} />
                            
                            {/* Imperfections Section */}
                            {parsedContent.subject?.imperfections && (
                                <div className="mt-2 pt-2 border-t border-indigo-500/10">
                                    <span className="text-[10px] text-gray-500 block mb-1 font-bold uppercase">Authenticity</span>
                                    <div className="grid grid-cols-2 gap-1">
                                        {parsedContent.subject.imperfections.skin && (
                                             <div>
                                                <span className="text-[9px] text-indigo-300/60 block">Skin</span>
                                                <p className="text-[10px] text-gray-400 leading-tight">{parsedContent.subject.imperfections.skin}</p>
                                             </div>
                                        )}
                                        {parsedContent.subject.imperfections.hair && (
                                             <div>
                                                <span className="text-[9px] text-indigo-300/60 block">Hair</span>
                                                <p className="text-[10px] text-gray-400 leading-tight">{parsedContent.subject.imperfections.hair}</p>
                                             </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-indigo-500/10">
                                <span className="text-[10px] text-gray-500 block mb-1">Makeup / Face</span>
                                <p className="text-xs text-gray-400 line-clamp-2">{parsedContent.subject?.face?.makeup}</p>
                            </div>
                        </div>
                    </div>

                    {/* Pane 2: Clothing (Pink/Rose) */}
                    <div className="bg-rose-900/10 border border-rose-500/20 rounded-lg p-3">
                        <SectionHeader 
                            title="Wardrobe" 
                            colorClass="text-rose-400 border-rose-500"
                            icon={<div className="w-3 h-3 rounded-full bg-rose-400/50" />} 
                        />
                        <div className="space-y-1">
                             <ClothingItem label="Top" item={parsedContent.subject?.clothing?.top} />
                             <ClothingItem label="Bottom" item={parsedContent.subject?.clothing?.bottom} />
                        </div>
                    </div>

                    {/* Pane 3: Background (Emerald/Teal) */}
                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3">
                        <SectionHeader 
                            title="Environment" 
                            colorClass="text-emerald-400 border-emerald-500"
                            icon={<div className="w-3 h-3 border border-emerald-400 rounded-sm" />} 
                        />
                        <KeyVal label="Setting" val={parsedContent.background?.setting} />
                        <KeyVal label="Lighting" val={parsedContent.background?.lighting} />
                        
                        {parsedContent.background?.elements && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {parsedContent.background.elements.slice(0, 4).map((el: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-emerald-950/50 border border-emerald-900/50 rounded text-[9px] text-emerald-200/80 truncate max-w-full">
                                        {el}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pane 4: Photography (Amber/Orange) */}
                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3">
                        <SectionHeader 
                            title="Camera & Tech" 
                            colorClass="text-amber-400 border-amber-500"
                            icon={<IconSettings className="w-3 h-3 text-amber-400" />} 
                        />
                         <KeyVal label="Shot" val={parsedContent.photography?.shot_type} />
                         <KeyVal label="Angle" val={parsedContent.photography?.angle} />
                         <KeyVal label="Device" val={parsedContent.photography?.camera_style} />
                         
                         {parsedContent.subject?.mirror_rules && parsedContent.subject.mirror_rules !== "N/A" && (
                             <div className="mt-2 p-1.5 bg-amber-900/20 rounded border border-amber-500/10">
                                 <span className="text-[9px] text-amber-500 block">⚠️ Mirror Protocol</span>
                                 <p className="text-[10px] text-amber-200/70 leading-tight">Text reversed, ignore physics</p>
                             </div>
                         )}
                    </div>

                 </div>

             </div>
          ) : (
            // Fallback for Raw Text (The Matrix View)
            <div className="font-mono text-xs text-green-400 bg-black/40 p-4 rounded-lg border border-green-900/30 shadow-inner h-full overflow-x-auto">
                <p className="whitespace-pre-wrap leading-relaxed opacity-80">{prompt.text}</p>
            </div>
          )
        )}
      </div>

      {/* FOOTER */}
      <div className="bg-black/20 p-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-600 font-mono">
          <div className="flex gap-2">
            {prompt.tags.map((t,i) => <span key={i}>#{t}</span>)}
          </div>
          {parsedContent && <span>JSON Validated</span>}
      </div>
    </div>
  );
};