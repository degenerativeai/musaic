
import React, { useState, useRef, useEffect } from 'react';
import { analyzeSubjectImages, generateDatasetPrompts } from './services/geminiService';
import { PromptCard } from './components/PromptCard';
import { SplashScreen } from './components/SplashScreen';
import { IconSparkles, IconDownload, IconRefresh, IconProduct, IconFlame, IconArrowLeft, IconArrowRight, IconTrash, IconUser, IconHistory, IconPackage, IconPlus, IconMusaic, IconKey, IconCheck } from './components/Icons';
import { PromptItem, TaskType, SafetyMode, IdentityContext, SavedInfluencer, UGCSettings } from './types';

// Helper to read file as base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const ITEMS_PER_PAGE = 10;
const STORAGE_KEY_INFLUENCERS = 'visionstruct_influencers';
const STORAGE_KEY_DRAFT = 'musaic_draft_state';

export default function App() {
    // --- Auth State ---
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [showSplash, setShowSplash] = useState(true);

    // --- Configuration State ---
    const [taskType, setTaskType] = useState<TaskType>('lora');
    const [ugcSettings, setUgcSettings] = useState<UGCSettings>({ platform: 'general', customInstruction: '' });
    const [safetyMode, setSafetyMode] = useState<SafetyMode>('sfw');
    const [targetTotal, setTargetTotal] = useState(50);

    // --- Context State ---
    const [description, setDescription] = useState(''); // Body Stack / Physical Profile
    const [identity, setIdentity] = useState<IdentityContext>({
        name: '',
        age_estimate: '',
        profession: '',
        backstory: ''
    });

    // --- Images ---
    const [headshot, setHeadshot] = useState<string | null>(null);
    const [bodyshot, setBodyshot] = useState<string | null>(null);
    const [productImages, setProductImages] = useState<(string | null)[]>([null, null, null]);

    // --- Output State ---
    const [prompts, setPrompts] = useState<PromptItem[]>([]);
    const [generatedCount, setGeneratedCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [usedSettings, setUsedSettings] = useState<string[]>([]);

    // --- Processing Flags ---
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authError, setAuthError] = useState(false);

    // --- Session Management ---
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [pendingTask, setPendingTask] = useState<TaskType | null>(null);
    const [recentInfluencers, setRecentInfluencers] = useState<SavedInfluencer[]>([]);
    const [isSelectingInfluencer, setIsSelectingInfluencer] = useState(false);

    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const storedKey = sessionStorage.getItem('gemini_api_key');
        if (storedKey) {
            setApiKey(storedKey);
            setShowSplash(false);
        }
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_INFLUENCERS);
            if (stored) {
                setRecentInfluencers(JSON.parse(stored));
            }
        } catch (e) { console.error("Failed to load history", e); }
    }, []);

    useEffect(() => {
        if (!showSplash) {
            const draft = { taskType, safetyMode, targetTotal, description, identity };
            localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));
        }
    }, [taskType, safetyMode, targetTotal, description, identity, showSplash]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY_DRAFT);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.taskType) setTaskType(parsed.taskType);
                if (parsed.safetyMode) setSafetyMode(parsed.safetyMode);
                if (parsed.targetTotal) setTargetTotal(parsed.targetTotal);
                if (parsed.description) setDescription(parsed.description);
                if (parsed.identity) setIdentity(parsed.identity);
            } catch (e) { console.error("Failed to restore draft", e); }
        }
    }, []);

    const saveToHistory = (desc: string, iden: IdentityContext) => {
        const newItem: SavedInfluencer = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            identity: iden,
            physical_profile: desc
        };
        const updated = [newItem, ...recentInfluencers].slice(0, 10);
        setRecentInfluencers(updated);
        localStorage.setItem(STORAGE_KEY_INFLUENCERS, JSON.stringify(updated));
    };

    useEffect(() => {
        if (prompts.length > 0) {
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [currentPage]);

    const totalPages = Math.ceil(prompts.length / ITEMS_PER_PAGE) || 1;
    const currentPrompts = prompts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleAuthComplete = (key: string | null) => {
        setApiKey(key);
        setShowSplash(false);
        setAuthError(false);
    };

    const reEnterKey = () => {
        sessionStorage.removeItem('gemini_api_key');
        setApiKey(null);
        setShowSplash(true);
        setAuthError(false);
    };

    const handleApiError = (e: any) => {
        console.error(e);
        const msg = e.message || '';
        if (msg.includes("API_KEY_MISSING") || msg.includes("403") || msg.includes("401") || msg.includes("429")) {
            setAuthError(true);
            setError("Authentication Failed: Invalid Key or Quota Exceeded.");
        } else {
            setError(msg || "An unexpected error occurred.");
        }
    };

    const triggerResetFlow = (newTask: TaskType | null = null) => {
        const hasData = prompts.length > 0 || description || headshot || bodyshot;
        if (!hasData) {
            if (newTask) setTaskType(newTask);
            return;
        }
        setPendingTask(newTask);
        setShowResetDialog(true);
    };

    const handleSessionReset = (keepSubject: boolean) => {
        setPrompts([]);
        setGeneratedCount(0);
        setCurrentPage(1);
        setUsedSettings([]);

        if (!keepSubject) {
            setHeadshot(null);
            setBodyshot(null);
            setProductImages([null, null, null]);
            setDescription('');
            setIdentity({ name: '', age_estimate: '', profession: '', backstory: '' });
            setTargetTotal(50);
        }
        if (pendingTask) setTaskType(pendingTask);
        setPendingTask(null);
        setShowResetDialog(false);
    };

    const handleToggleCopy = (id: string) => {
        setPrompts(prev => prev.map(p => p.id === id ? { ...p, isCopied: true } : p));
    };

    const handleUpdatePrompt = (id: string, newText: string) => {
        setPrompts(prev => prev.map(p => p.id === id ? { ...p, text: newText } : p));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'head' | 'body' | 'product', index: number = 0) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const target = e.target;
        try {
            const base64 = await fileToBase64(file);
            if (type === 'head') setHeadshot(base64);
            else if (type === 'body') setBodyshot(base64);
            else {
                const newImages = [...productImages];
                newImages[index] = base64;
                setProductImages(newImages);
            }
        } catch (err) {
            setError("Failed to process image.");
        } finally {
            setTimeout(() => { target.value = ''; }, 200);
        }
    };

    const handleAnalyze = async () => {
        if (!headshot && !bodyshot) {
            setError("Please upload at least one subject image to analyze.");
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        setAuthError(false);
        try {
            const result = await analyzeSubjectImages(headshot, bodyshot);

            // Universal Mapping: body_stack is the detailed profile for BOTH modes
            setDescription(result.identity_profile.body_stack);

            const newIdentity = {
                name: result.identity_profile.uid || 'Subject',
                age_estimate: result.identity_profile.age_estimate || '',
                profession: result.identity_profile.archetype_anchor,
                backstory: result.identity_profile.realism_stack
            };
            setIdentity(newIdentity);
            saveToHistory(result.identity_profile.body_stack, newIdentity);

        } catch (e: any) {
            handleApiError(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSelectInfluencer = (influencer: SavedInfluencer) => {
        setIdentity(influencer.identity);
        setDescription(influencer.physical_profile);
        setHeadshot(null);
        setBodyshot(null);
        setIsSelectingInfluencer(false);
    };

    const handleGenerateBatch = async () => {
        if (!description && taskType !== 'ugc') {
            setError("Subject Analysis required for LoRA/Product tasks.");
            return;
        }
        const activeProducts = productImages.filter(img => img !== null) as string[];
        if (taskType === 'product' && activeProducts.length === 0) {
            setError("At least one Product Image required for Product task.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setAuthError(false);

        const remaining = targetTotal - generatedCount;
        const batchSize = Math.min(ITEMS_PER_PAGE, remaining);

        if (batchSize <= 0) {
            setIsGenerating(false);
            return;
        }

        try {
            const newPrompts = await generateDatasetPrompts({
                taskType,
                subjectDescription: description,
                identity,
                safetyMode,
                productImages: activeProducts,
                count: batchSize,
                startCount: generatedCount,
                totalTarget: targetTotal,
                ugcSettings,
                previousSettings: usedSettings
            });

            if (!newPrompts || newPrompts.length === 0) {
                throw new Error("No prompts generated by the AI.");
            }

            // Anti-repetition logic for Rich JSON mode
            const newSettings: string[] = [];
            newPrompts.forEach(p => {
                try {
                    const cleaned = p.text.replace(/```json\n ?| ```/g, '').trim();
                    const json = JSON.parse(cleaned);
                    if (json.background?.setting) {
                        newSettings.push(json.background.setting);
                    }
                } catch (e) { }
            });
            setUsedSettings(prev => [...prev, ...newSettings]);

            setPrompts(prev => [...prev, ...newPrompts]);
            setGeneratedCount(prev => prev + newPrompts.length);

            const newTotal = prompts.length + newPrompts.length;
            const newPage = Math.ceil(newTotal / ITEMS_PER_PAGE);
            setCurrentPage(newPage);

        } catch (e: any) {
            handleApiError(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const resetError = () => { setError(null); setAuthError(false); };

    const exportPrompts = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prompts, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `musaic_dataset_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <>
            {showSplash && <SplashScreen onComplete={handleAuthComplete} />}

            {!showSplash && (
                <div className="min-h-screen bg-obsidian text-gray-200 font-sans selection:bg-musaicPurple selection:text-white">

                    <header className="fixed top-0 left-0 right-0 h-16 bg-charcoal/80 backdrop-blur-md border-b border-gray-800 z-40 flex items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                            <IconMusaic className="w-8 h-8" />
                            <span className="font-bold text-xl tracking-tight text-white hidden sm:block">MUSAIC</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button onClick={() => triggerResetFlow(taskType)} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all flex items-center gap-2">
                                <IconPlus className="w-4 h-4" /> New Session
                            </button>
                            <div className="h-6 w-px bg-gray-700 mx-2 hidden sm:block"></div>
                            {apiKey ? (
                                <button onClick={reEnterKey} title="Change API Key" className="group">
                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] group-hover:shadow-[0_0_12px_rgba(34,197,94,1)] transition-all"></div>
                                </button>
                            ) : (
                                <button onClick={reEnterKey} className="text-xs text-yellow-500 hover:text-yellow-400 font-mono">Demo Mode</button>
                            )}
                        </div>
                    </header>

                    {showResetDialog && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                            <div className="bg-charcoal border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                                <h3 className="text-lg font-bold text-white">Start New Session?</h3>
                                <div className="flex flex-col gap-2 pt-2">
                                    <button onClick={() => handleSessionReset(true)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"><IconUser className="w-4 h-4 text-musaicPurple" /> Keep Current Subject</button>
                                    <button onClick={() => handleSessionReset(false)} className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-300 border border-red-900/50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"><IconTrash className="w-4 h-4" /> Reset Everything</button>
                                    <button onClick={() => { setShowResetDialog(false); setPendingTask(null); }} className="w-full py-2 text-gray-500 hover:text-white text-xs mt-2">Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8" ref={topRef}>

                        <div className="lg:col-span-4 space-y-8">
                            <div className="bg-charcoal border border-gray-800 rounded-2xl p-1 overflow-hidden flex shadow-lg">
                                {(['lora', 'product', 'ugc'] as TaskType[]).map((t) => (
                                    <button key={t} onClick={() => { if (taskType !== t) triggerResetFlow(t); }} className={`flex - 1 py - 3 text - xs font - bold uppercase tracking - wide transition - all rounded - xl ${taskType === t ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white shadow-inner border border-gray-600' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'} `}>{t === 'ugc' ? 'UGC' : t}</button>
                                ))}
                            </div>

                            <section className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-musaicPurple"></span>Context</h2>
                                    {(taskType === 'product' || taskType === 'lora') && !isSelectingInfluencer && (
                                        <button onClick={() => setIsSelectingInfluencer(!isSelectingInfluencer)} className="text-[10px] text-musaicGold hover:underline flex items-center gap-1"><IconHistory className="w-3 h-3" />History</button>
                                    )}
                                </div>

                                {isSelectingInfluencer && (
                                    <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 space-y-2 mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-xs font-bold text-gray-300">Saved Influencers</h3>
                                            <button onClick={() => setIsSelectingInfluencer(false)} className="text-xs text-gray-500">Close</button>
                                        </div>
                                        {recentInfluencers.length === 0 ? <p className="text-xs text-gray-500 italic">No history yet.</p> : (
                                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                                {recentInfluencers.map(inf => (
                                                    <button key={inf.id} onClick={() => handleSelectInfluencer(inf)} className="w-full text-left p-2 rounded hover:bg-white/10 text-xs truncate border border-transparent hover:border-gray-600 transition-colors">
                                                        <span className="font-bold text-white block">{inf.identity.name || 'Unnamed'}</span>
                                                        <span className="text-gray-500">{inf.identity.profession}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {taskType !== 'ugc' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Headshot</label>
                                            <div className={`relative h - 32 rounded - 2xl border - 2 overflow - hidden transition - all ${headshot ? 'border-musaicPurple' : 'border-dashed border-gray-700 hover:border-gray-500 bg-black/20'} `}>
                                                {headshot ? (
                                                    <>
                                                        <img src={headshot} alt="Head" className="w-full h-full object-cover" />
                                                        <button onClick={() => setHeadshot(null)} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors"><IconTrash className="w-3 h-3" /></button>
                                                    </>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer"><IconUser className="w-6 h-6 text-gray-600 mb-1" /><span className="text-[9px] text-gray-500">Upload</span><input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleImageUpload(e, 'head')} className="hidden" /></label>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-bold text-gray-500">Full Body</label>
                                            <div className={`relative h - 32 rounded - 2xl border - 2 overflow - hidden transition - all ${bodyshot ? 'border-musaicPurple' : 'border-dashed border-gray-700 hover:border-gray-500 bg-black/20'} `}>
                                                {bodyshot ? (
                                                    <>
                                                        <img src={bodyshot} alt="Body" className="w-full h-full object-cover" />
                                                        <button onClick={() => setBodyshot(null)} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors"><IconTrash className="w-3 h-3" /></button>
                                                    </>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer"><IconUser className="w-6 h-6 text-gray-600 mb-1" /><span className="text-[9px] text-gray-500">Upload</span><input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleImageUpload(e, 'body')} className="hidden" /></label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {taskType !== 'ugc' && (
                                    <button onClick={handleAnalyze} disabled={isAnalyzing || (!headshot && !bodyshot)} className={`w - full py - 3 rounded - xl font - bold uppercase text - xs tracking - widest transition - all flex items - center justify - center gap - 2 ${isAnalyzing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-musaicPurple hover:to-blue-600 text-white shadow-lg'} `}>
                                        {isAnalyzing ? <><IconRefresh className="w-4 h-4 animate-spin" /> Analyzing...</> : <><IconSparkles className="w-4 h-4 text-musaicGold" /> Analyze Profile</>}
                                    </button>
                                )}

                                <div className="space-y-3 pt-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Name</label>
                                            <input type="text" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="Auto-inferred..." className="w-full bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Age</label>
                                            <input type="text" value={identity.age_estimate} onChange={(e) => setIdentity({ ...identity, age_estimate: e.target.value })} placeholder="e.g. 25yo" className="w-full bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">{taskType === 'lora' ? 'Archetype' : 'Profession'}</label>
                                            <input type="text" value={identity.profession} onChange={(e) => setIdentity({ ...identity, profession: e.target.value })} placeholder={taskType === 'lora' ? "Young Woman" : "Influencer"} className="w-full bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">{taskType === 'lora' ? 'Realism Stack' : 'Backstory / Vibe'}</label>
                                        <textarea value={identity.backstory} onChange={(e) => setIdentity({ ...identity, backstory: e.target.value })} placeholder={taskType === 'lora' ? "Realism tags..." : "A brief backstory..."} rows={4} className="w-full bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none resize-none" />
                                    </div>
                                </div>

                                {taskType === 'product' && (
                                    <div className="pt-4 border-t border-gray-800 space-y-3">
                                        <label className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><IconPackage className="w-4 h-4" /> Product Assets</label>
                                        <div className="flex gap-2">
                                            {[0, 1, 2].map((idx) => (
                                                <div key={idx} className={`relative flex - 1 h - 20 rounded - xl border border - dashed border - gray - 700 bg - black / 20 overflow - hidden hover: border - gray - 500 transition - colors`}>
                                                    {productImages[idx] ? (
                                                        <>
                                                            <img src={productImages[idx]!} className="w-full h-full object-cover" />
                                                            <button onClick={() => { const newImgs = [...productImages]; newImgs[idx] = null; setProductImages(newImgs); }} className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 text-white rounded-full"><IconTrash className="w-3 h-3" /></button>
                                                        </>
                                                    ) : (
                                                        <label className="w-full h-full flex items-center justify-center cursor-pointer"><IconPlus className="w-4 h-4 text-gray-600" /><input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={(e) => handleImageUpload(e, 'product', idx)} /></label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="space-y-6 pt-6 border-t border-gray-800 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-musaicPurple"></span>Generation</h2>
                                    {taskType === 'lora' && (
                                        <button onClick={() => setSafetyMode(safetyMode === 'sfw' ? 'nsfw' : 'sfw')} className={`px - 3 py - 1 rounded - full text - [10px] font - bold uppercase transition - all flex items - center gap - 1 border ${safetyMode === 'nsfw' ? 'bg-red-900/20 text-red-400 border-red-900/50 shadow-[0_0_10px_rgba(248,113,113,0.2)]' : 'bg-green-900/20 text-green-400 border-green-900/50'} `}>
                                            {safetyMode === 'nsfw' ? <><IconFlame className="w-3 h-3" /> Accentuate Form</> : 'Standard Mode'}
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-mono text-gray-400"><span>Target Count</span><span className="text-white">{targetTotal} Prompts</span></div>
                                    <input type="range" min="10" max="100" step="10" value={targetTotal} onChange={(e) => setTargetTotal(Number(e.target.value))} className="w-full" />
                                    <div className="flex justify-between text-[10px] text-gray-600 font-mono"><span>10</span><span>100</span></div>
                                </div>

                                <button onClick={handleGenerateBatch} disabled={isGenerating || generatedCount >= targetTotal || (taskType !== 'ugc' && !description)} className={`w - full py - 4 rounded - xl font - bold uppercase text - sm tracking - widest transition - all shadow - xl hover: scale - [1.02] active: scale - [0.98] ${generatedCount >= targetTotal ? 'bg-green-600 text-white cursor-default' : isGenerating ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-gradient-to-r from-musaicPurple to-blue-600 text-white hover:shadow-musaicPurple/25'} `}>
                                    {isGenerating ? <span className="flex items-center justify-center gap-2"><span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>Synthesizing...</span> : generatedCount >= targetTotal ? <span className="flex items-center justify-center gap-2"><IconCheck className="w-5 h-5" /> Complete</span> : `Generate ${Math.min(ITEMS_PER_PAGE, targetTotal - generatedCount) === 0 ? '' : 'Next ' + Math.min(ITEMS_PER_PAGE, targetTotal - generatedCount)} `}
                                </button>

                                {(error || authError) && (
                                    <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-xs flex items-start gap-2 animate-fade-in"><span className="text-lg leading-none">!</span><div className="flex-1"><p>{error}</p>{authError && <button onClick={reEnterKey} className="underline hover:text-white mt-1">Re-enter API Key</button>}</div><button onClick={resetError} className="text-red-400 hover:text-white">✕</button></div>
                                )}
                            </section>
                        </div>

                        <div className="lg:col-span-8 bg-black/40 border border-gray-800 rounded-3xl p-6 min-h-[600px] flex flex-col relative overflow-hidden backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-baseline gap-4"><h2 className="text-2xl font-bold text-white tracking-tight">Dataset</h2><span className="font-mono text-musaicPurple text-sm">{generatedCount} / {targetTotal}</span></div>
                                <div className="flex gap-2">{prompts.length > 0 && <button onClick={exportPrompts} className="px-4 py-2 bg-charcoal hover:bg-gray-800 text-gray-300 text-xs font-bold uppercase tracking-wide rounded-lg border border-gray-700 flex items-center gap-2 transition-colors"><IconDownload className="w-4 h-4" /> JSON</button>}</div>
                            </div>

                            {prompts.length === 0 && !isGenerating && (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-4">
                                    <div className="p-6 rounded-full bg-gray-800/30 border border-gray-700/50"><IconSparkles className="w-12 h-12 opacity-50" /></div>
                                    <p className="text-sm font-mono text-center max-w-xs">Configured & Ready.<br />Upload context or click Generate to begin.</p>
                                    {taskType === 'ugc' && <button onClick={handleGenerateBatch} className="mt-4 px-6 py-2 bg-musaicPurple/20 text-musaicPurple border border-musaicPurple/50 rounded-lg text-xs font-bold uppercase hover:bg-musaicPurple/30 transition-colors">Start Generic Batch</button>}
                                </div>
                            )}

                            <div className="space-y-4 flex-1 pb-20">
                                {currentPrompts.map((p) => <PromptCard key={p.id} prompt={p} onUpdate={handleUpdatePrompt} onToggleCopy={handleToggleCopy} isCopied={!!p.isCopied} />)}

                                {generatedCount < targetTotal && prompts.length > 0 && (
                                    <div className="pt-8 pb-4 flex justify-center">
                                        <button onClick={handleGenerateBatch} disabled={isGenerating} className={`w - full max - w - md py - 4 rounded - xl font - bold uppercase text - sm tracking - widest border shadow - lg transition - all flex items - center justify - center gap - 2 group ${isGenerating ? 'bg-gray-800 text-gray-500 border-gray-800 cursor-wait' : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700 hover:border-gray-500'} `}>
                                            {isGenerating ? <><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>Synthesizing...</> : <><IconSparkles className="w-4 h-4 text-musaicGold group-hover:rotate-12 transition-transform" />Generate Next Batch ({Math.min(ITEMS_PER_PAGE, targetTotal - generatedCount)})</>}
                                        </button>
                                    </div>
                                )}

                                {isGenerating && <div className="space-y-4 animate-pulse opacity-50">{[1, 2].map(i => <div key={i} className="h-48 bg-gray-800/50 rounded-xl border border-gray-700/50"></div>)}</div>}
                            </div>

                            {prompts.length > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-between border-t border-gray-800/30">
                                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconArrowLeft className="w-5 h-5" /></button>
                                    <span className="font-mono text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
                                    <div className="flex gap-2"><button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconArrowRight className="w-5 h-5" /></button></div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            )}
        </>
    );
}
