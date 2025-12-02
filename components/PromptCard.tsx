
import React, { useState, useMemo } from 'react';
import { PromptItem } from '../types';
import { IconCopy, IconEdit, IconCheck, IconSettings, IconUser } from './Icons';

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

    // Determine Mode
    const isLoRAMode = !!parsedContent?.generation_data;

    // Dense Data (LoRA)
    const finalString = parsedContent?.generation_data?.final_prompt_string || (parsedContent?.subject ? `Hyper-realistic ${parsedContent.photography?.shot_type || 'Shot'}, ${parsedContent.subject.description || ''}, ${parsedContent.background?.setting || ''}, ${parsedContent.subject.clothing?.top?.type || ''} ${parsedContent.subject.clothing?.top?.color || ''}, ${parsedContent.subject.clothing?.bottom?.type || ''} ${parsedContent.subject.clothing?.bottom?.color || ''}, 8k, raw photo.` : prompt.text);
    const refLogic = parsedContent?.generation_data?.reference_logic;

    // Rich Data (Product/Generic)
    const subject = parsedContent?.subject;
    const background = parsedContent?.background;
    const photography = parsedContent?.photography;

    const handleCopy = () => {
        // If Multi-Pane, copy prettified JSON. If LoRA, copy dense string.
        const textToCopy = isLoRAMode ? finalString : (parsedContent ? JSON.stringify(parsedContent, null, 2) : prompt.text);
        navigator.clipboard.writeText(textToCopy);
        onToggleCopy(prompt.id);
    };

    const saveEdit = () => {
        if (isLoRAMode && parsedContent) {
            parsedContent.generation_data.final_prompt_string = editText;
            onUpdate(prompt.id, JSON.stringify(parsedContent));
        } else {
            onUpdate(prompt.id, editText);
        }
        setIsEditing(false);
    };

    const startEdit = () => {
        setEditText(isLoRAMode ? finalString : prompt.text);
        setIsEditing(true);
    }

    const meta = prompt.generationMeta;

    // --- Helper Components for Multi-Pane ---
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ClothingItem = ({ label, item }: { label: string, item: any }) => {
        let content = <span className="text-gray-600 italic text-[10px]">Not specified</span>;
        if (item && Object.keys(item).length > 0) {
            const type = item.type || item.style || item.item || item.name || "Garment";
            const color = item.color || "";
            const details = item.details || item.description || "";
            content = (
                <div className="flex flex-col">
                    <span className="text-xs text-gray-200 font-medium">{color} {type}</span>
                    {details && <span className="text-[9px] text-gray-500 leading-tight mt-0.5">{details}</span>}
                </div>
            );
        }
        return (
            <div className="mb-2">
                <span className={`text-[10px] uppercase font-bold text-rose-300/60 block mb-0.5`}>{label}</span>
                {content}
            </div>
        );
    };

    return (
        <div className={`group relative bg-charcoal border rounded-xl p-0 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/60 ${isCopied
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

                        {/* VIEW A: LORA DENSE STRING */}
                        {isLoRAMode && (
                            <>
                                <div className="bg-black/30 p-4 rounded-lg border border-white/5 font-mono text-xs text-green-400/90 leading-relaxed break-words shadow-inner">
                                    {finalString}
                                </div>
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
                            </>
                        )}

                        {/* VIEW B: RICH JSON PANELS */}
                        {subject && (
                            <>
                                <div className="bg-gradient-to-br from-gray-800/30 to-black/30 p-3 rounded-lg border border-white/5">
                                    <p className="text-sm text-gray-200 font-medium leading-relaxed italic">
                                        "{subject.description || "No description available"}"
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Identity */}
                                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-3">
                                        <SectionHeader title="Subject Identity" colorClass="text-indigo-400 border-indigo-500" icon={<IconUser className="w-3 h-3 text-indigo-400" />} />
                                        <KeyVal label="Age" val={subject.age} />
                                        <KeyVal label="Expression" val={subject.expression} />
                                        {/* Imperfections */}
                                        {subject.imperfections && (
                                            <div className="mt-2 pt-2 border-t border-indigo-500/10">
                                                <span className="text-[10px] text-gray-500 block mb-1 font-bold uppercase">Authenticity</span>
                                                <p className="text-[10px] text-gray-400 leading-tight">{subject.imperfections.skin} {subject.imperfections.hair} {subject.imperfections.general}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Wardrobe */}
                                    <div className="bg-rose-900/10 border border-rose-500/20 rounded-lg p-3">
                                        <SectionHeader title="Wardrobe" colorClass="text-rose-400 border-rose-500" icon={<div className="w-3 h-3 rounded-full bg-rose-400/50" />} />
                                        <ClothingItem label="Top" item={subject.clothing?.top} />
                                        <ClothingItem label="Bottom" item={subject.clothing?.bottom} />
                                    </div>

                                    {/* Environment */}
                                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3">
                                        <SectionHeader title="Environment" colorClass="text-emerald-400 border-emerald-500" icon={<div className="w-3 h-3 border border-emerald-400 rounded-sm" />} />
                                        <KeyVal label="Setting" val={background?.setting} />
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {background?.elements?.slice(0, 4).map((el: string, i: number) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-emerald-950/50 border border-emerald-900/50 rounded text-[9px] text-emerald-200/80 truncate max-w-full">{el}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Camera */}
                                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3">
                                        <SectionHeader title="Camera" colorClass="text-amber-400 border-amber-500" icon={<IconSettings className="w-3 h-3 text-amber-400" />} />
                                        <KeyVal label="Shot" val={photography?.shot_type} />
                                        <KeyVal label="Angle" val={photography?.angle} />
                                        <KeyVal label="Device" val={photography?.camera_style} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* FALLBACK */}
                        {!isLoRAMode && !subject && (
                            <p className="text-gray-200 text-sm font-mono leading-relaxed whitespace-pre-wrap">{prompt.text}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
