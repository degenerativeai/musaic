import React, { useState, useRef, useEffect } from 'react';
import { analyzeSubjectImages, generateDatasetPrompts } from './services/geminiService';
import { PromptCard } from './components/PromptCard';
import { SplashScreen } from './components/SplashScreen';
import { IconSparkles, IconDownload, IconRefresh, IconProduct, IconFlame, IconArrowLeft, IconArrowRight, IconTrash, IconUser, IconHistory, IconPackage, IconPlus, IconMusaic, IconKey } from './components/Icons';
import { PromptItem, TaskType, SafetyMode, IdentityContext, SavedInfluencer } from './types';

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

export default function App() {
  // --- Auth State ---
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  // --- Configuration State ---
  const [taskType, setTaskType] = useState<TaskType>('lora');
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('sfw');
  const [targetTotal, setTargetTotal] = useState(50);
  
  // --- Context State ---
  const [description, setDescription] = useState(''); // Physical Profile
  const [identity, setIdentity] = useState<IdentityContext>({
      name: '',
      profession: '',
      backstory: ''
  });

  // --- Images ---
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [bodyshot, setBodyshot] = useState<string | null>(null);
  
  // Product Images (Array of up to 3)
  const [productImages, setProductImages] = useState<(string | null)[]>([null, null, null]);

  // --- Output State ---
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Processing Flags ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false); // New: Track API Key errors

  // --- Session Management ---
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [pendingTask, setPendingTask] = useState<TaskType | null>(null);

  // --- Influencer History ---
  const [recentInfluencers, setRecentInfluencers] = useState<SavedInfluencer[]>([]);
  const [isSelectingInfluencer, setIsSelectingInfluencer] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  // Check for existing session key on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem('gemini_api_key');
    if (storedKey) {
        setApiKey(storedKey);
        setShowSplash(false);
    }
  }, []);

  // Load history on mount
  useEffect(() => {
      try {
          const stored = localStorage.getItem(STORAGE_KEY_INFLUENCERS);
          if (stored) {
              setRecentInfluencers(JSON.parse(stored));
          }
      } catch (e) { console.error("Failed to load history", e); }
  }, []);

  // Save Analysis Result to History
  const saveToHistory = (desc: string, iden: IdentityContext) => {
      const newItem: SavedInfluencer = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          identity: iden,
          physical_profile: desc
      };
      const updated = [newItem, ...recentInfluencers].slice(0, 10); // Keep last 10
      setRecentInfluencers(updated);
      localStorage.setItem(STORAGE_KEY_INFLUENCERS, JSON.stringify(updated));
  };

  // Scroll to top when page changes
  useEffect(() => {
    if (prompts.length > 0) {
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentPage]);

  // --- Computed Pagination ---
  const totalPages = Math.ceil(prompts.length / ITEMS_PER_PAGE) || 1;
  const currentPrompts = prompts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- Handlers ---

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
    // If we have no significant data, just switch
    const hasData = prompts.length > 0 || description || headshot || bodyshot;
    if (!hasData) {
        if (newTask) setTaskType(newTask);
        return;
    }
    setPendingTask(newTask);
    setShowResetDialog(true);
  };

  const handleSessionReset = (keepSubject: boolean) => {
    // 1. Reset generated content
    setPrompts([]);
    setGeneratedCount(0);
    setCurrentPage(1);
    
    // 2. Conditional Reset
    if (!keepSubject) {
        setHeadshot(null);
        setBodyshot(null);
        setProductImages([null, null, null]);
        setDescription('');
        setIdentity({ name: '', profession: '', backstory: '' });
        setTargetTotal(50); 
    }

    // 3. Switch Task if pending
    if (pendingTask) {
        setTaskType(pendingTask);
    }

    setPendingTask(null);
    setShowResetDialog(false);
  };

  const handleToggleCopy = (id: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, isCopied: true } : p));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'head' | 'body' | 'product', index: number = 0) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      if (type === 'head') setHeadshot(base64);
      else if (type === 'body') setBodyshot(base64);
      else {
          const newImages = [...productImages];
          newImages[index] = base64;
          setProductImages(newImages);
      }
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
        setDescription(result.physical_profile);
        
        const newIdentity = {
            name: result.identity_inference.name,
            profession: result.identity_inference.profession,
            backstory: result.identity_inference.backstory,
        };
        setIdentity(newIdentity);
        saveToHistory(result.physical_profile, newIdentity);

    } catch (e: any) {
        handleApiError(e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSelectInfluencer = (influencer: SavedInfluencer) => {
      setIdentity(influencer.identity);
      setDescription(influencer.physical_profile);
      setHeadshot(null); // Clear images as we are using cached data
      setBodyshot(null);
      setIsSelectingInfluencer(false);
  };

  const handleGenerateBatch = async () => {
    if (!description && taskType !== 'generic') {
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
            totalTarget: targetTotal
        });

        if (!newPrompts || newPrompts.length === 0) {
             throw new Error("AI returned no prompts. Please try again or check inputs.");
        }

        setPrompts(prev => [...prev, ...newPrompts]);
        setGeneratedCount(prev => prev + newPrompts.length);
        
        const newTotalPages = Math.ceil((prompts.length + newPrompts.length) / ITEMS_PER_PAGE);
        setCurrentPage(newTotalPages);

    } catch (e: any) {
        handleApiError(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset_${taskType}_${identity.name.replace(/\s/g,'_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (showSplash) {
      return <SplashScreen onComplete={handleAuthComplete} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-obsidian text-gray-200 font-sans selection:bg-accent/30 selection:text-white">
      
      {/* --- SESSION DIALOG OVERLAY --- */}
      {showResetDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-charcoal border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
                  <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <span className="text-accent">❖</span> Session Conflict
                      </h3>
                      <p className="text-sm text-gray-400">
                          {pendingTask ? `You are switching to ${pendingTask.toUpperCase()} mode.` : 'You requested a reset.'} 
                          <br/>How would you like to proceed with the current data?
                      </p>
                  </div>

                  <div className="space-y-3">
                      <button 
                        onClick={() => handleSessionReset(true)}
                        className="w-full p-4 rounded-xl border border-gray-700 hover:border-accent bg-gray-800/50 hover:bg-gray-800 transition-all flex items-center gap-4 group text-left"
                      >
                          <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <IconUser className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-gray-200 group-hover:text-white">Keep Subject Profile</p>
                              <p className="text-xs text-gray-500">Reset prompts but keep analysis & images</p>
                          </div>
                      </button>

                      <button 
                        onClick={() => handleSessionReset(false)}
                         className="w-full p-4 rounded-xl border border-gray-700 hover:border-red-500/50 bg-gray-800/50 hover:bg-red-900/10 transition-all flex items-center gap-4 group text-left"
                      >
                          <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <IconTrash className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-gray-200 group-hover:text-white">Start Fresh Session</p>
                              <p className="text-xs text-gray-500">Clear everything and start over</p>
                          </div>
                      </button>
                  </div>
                  
                  <button 
                    onClick={() => { setShowResetDialog(false); setPendingTask(null); }}
                    className="w-full py-2 text-xs font-mono text-gray-500 hover:text-white transition-colors"
                  >
                      CANCEL
                  </button>
              </div>
          </div>
      )}

      {/* --- LEFT CONTROL PANEL --- */}
      <aside className="w-full md:w-[480px] bg-charcoal/50 border-r border-gray-800 flex flex-col h-screen overflow-y-auto custom-scrollbar sticky top-0 z-20 backdrop-blur-xl">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2">
                    <IconMusaic className="w-8 h-8" />
                    MUSAIC
                </h1>
                <p className="text-xs text-gray-500 mt-1 font-mono">Dataset Architect v2.2</p>
            </div>
            <div className="flex gap-2">
                 <button 
                    onClick={reEnterKey}
                    className="p-2 text-gray-500 hover:text-musaicGold hover:bg-gray-800 rounded-lg transition-colors"
                    title="Update API Key"
                >
                    <IconKey className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => triggerResetFlow(null)}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Reset / New Session"
                >
                    <IconTrash className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="p-6 space-y-8 flex-1">
            
            {/* 1. Task Selection */}
            <div className="space-y-4">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Operation Mode</label>
                 <div className="grid grid-cols-3 gap-2 p-1 bg-black/40 rounded-lg border border-gray-800">
                    {(['generic', 'lora', 'product'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => type !== taskType && triggerResetFlow(type)}
                            className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-md transition-all ${
                                taskType === type 
                                ? 'bg-musaicPurple text-white shadow-lg' 
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                 </div>
            </div>

            {/* 2. Target Count Slider */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Target Size</label>
                    <span className="text-3xl font-light text-musaicPurple">{targetTotal}</span>
                </div>
                <div className="relative pt-2">
                    <input 
                        type="range" min="10" max="100" step="10" 
                        value={targetTotal}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            // Only allow increasing if mid-generation, or any value if not generating
                            if (val >= generatedCount) setTargetTotal(val);
                        }}
                        disabled={isGenerating}
                        className="w-full accent-musaicPurple"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-2">
                        <span>10</span><span>50</span><span>100</span>
                    </div>
                </div>
            </div>

            {/* 3. Subject Identity (For LoRA/Product) */}
            {(taskType === 'lora' || taskType === 'product') && (
                <div className="space-y-4 animate-fade-in-up">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                        Subject Context
                        <span className="text-[10px] text-gray-600 font-normal normal-case">Autofills on Analysis</span>
                    </label>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Full Name (e.g. Marina Gonzalez)"
                            value={identity.name}
                            onChange={e => setIdentity({...identity, name: e.target.value})}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-musaicPurple outline-none"
                        />
                         <input 
                            type="text" 
                            placeholder="Profession (e.g. Travel Blogger)"
                            value={identity.profession}
                            onChange={e => setIdentity({...identity, profession: e.target.value})}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-musaicPurple outline-none"
                        />
                         <textarea 
                            placeholder="Backstory & Vibe (e.g. Loves exotic beaches, luxury lifestyle)"
                            value={identity.backstory}
                            onChange={e => setIdentity({...identity, backstory: e.target.value})}
                            className="w-full bg-black/20 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-musaicPurple outline-none min-h-[80px]"
                        />
                    </div>
                </div>
            )}

            {/* 4. Product Upload (Product Only - Multi Slot) */}
            {taskType === 'product' && (
                <div className="space-y-4 animate-fade-in-up">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product References (Max 3)</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map(idx => (
                             <div key={idx} className={`upload-zone h-24 rounded-xl relative overflow-hidden group cursor-pointer ${productImages[idx] ? 'border-none' : ''}`}>
                                <input 
                                    type="file" accept="image/*" 
                                    onChange={(e) => handleImageUpload(e, 'product', idx)}
                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                />
                                {productImages[idx] ? (
                                    <img src={productImages[idx] || ''} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                        <IconPlus className="w-6 h-6 mb-1 opacity-50" />
                                        <span className="text-[8px] uppercase font-bold">
                                            {idx === 0 ? 'Main' : idx === 1 ? 'Pack' : 'Detail'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">Upload product, packaging, or detail shots for creative synthesis.</p>
                </div>
            )}

            {/* 5. Subject Images & Analysis (With Influencer Selector for Product) */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject Source</label>
                    {taskType === 'product' && recentInfluencers.length > 0 && (
                        <button 
                            onClick={() => setIsSelectingInfluencer(!isSelectingInfluencer)}
                            className="text-[10px] text-musaicPurple hover:text-white flex items-center gap-1 font-mono"
                        >
                            <IconHistory className="w-3 h-3" />
                            {isSelectingInfluencer ? 'Close History' : 'Recent Profiles'}
                        </button>
                    )}
                </div>
                
                {isSelectingInfluencer ? (
                    <div className="space-y-2 animate-fade-in">
                        {recentInfluencers.map(inf => (
                            <button 
                                key={inf.id}
                                onClick={() => handleSelectInfluencer(inf)}
                                className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left border border-gray-700 hover:border-gray-500 transition-all group"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-200 group-hover:text-white">{inf.identity.name}</span>
                                    <span className="text-[10px] text-gray-500">{new Date(inf.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 truncate">{inf.identity.profession}</p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* If we have selected a historical influencer but no new images, show lock state */}
                        {(!headshot && !bodyshot && description && taskType === 'product') ? (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-blue-200">{identity.name || 'Selected Profile'}</p>
                                    <p className="text-[10px] text-blue-400">Using cached physical analysis</p>
                                </div>
                                <button 
                                    onClick={() => { setDescription(''); setIdentity({name:'',profession:'',backstory:''}); }}
                                    className="text-xs text-gray-400 hover:text-white"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className={`upload-zone h-40 rounded-xl relative overflow-hidden group cursor-pointer ${headshot ? 'border-none' : ''}`}>
                                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'head')} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                                        {headshot ? <img src={headshot} alt="Head" className="w-full h-full object-cover" /> : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                                <span className="text-2xl mb-2">+</span><span className="text-[10px] uppercase font-bold">Head Shot</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                     <div className={`upload-zone h-40 rounded-xl relative overflow-hidden group cursor-pointer ${bodyshot ? 'border-none' : ''}`}>
                                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'body')} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                                        {bodyshot ? <img src={bodyshot} alt="Body" className="w-full h-full object-cover" /> : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                                <span className="text-2xl mb-2">+</span><span className="text-[10px] uppercase font-bold">Full Body</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {(headshot || bodyshot) && (
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-mono uppercase tracking-wide text-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 animate-fade-in-up"
                            >
                                {isAnalyzing ? <span className="animate-spin">⟳</span> : <IconSparkles className="w-3 h-3" />}
                                {isAnalyzing ? 'Running VisionStruct...' : 'Analyze Physical Profile'}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 6. Safety Mode (LoRA Only) */}
            {taskType === 'lora' && (
                <div className="space-y-4 pt-4 border-t border-gray-800">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        Safety Calibration
                        {safetyMode === 'nsfw' && <IconFlame className="w-3 h-3 text-red-500" />}
                    </label>
                    <div className="flex bg-black/40 p-1 rounded-lg border border-gray-800">
                        <button 
                            onClick={() => setSafetyMode('sfw')}
                            className={`flex-1 py-2 text-[10px] uppercase font-bold rounded transition-all ${safetyMode === 'sfw' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            SFW (Modest)
                        </button>
                        <button 
                            onClick={() => setSafetyMode('nsfw')}
                            className={`flex-1 py-2 text-[10px] uppercase font-bold rounded transition-all ${safetyMode === 'nsfw' ? 'bg-red-900/50 text-red-200 shadow-inner' : 'text-gray-500 hover:text-red-900/50'}`}
                        >
                            NSFW (Accentuate)
                        </button>
                    </div>
                </div>
            )}
        </div>
      </aside>

      {/* --- RIGHT OUTPUT PANEL --- */}
      <main className="flex-1 h-screen relative flex flex-col overflow-hidden bg-obsidian">
         
         {/* Toolbar */}
         <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-charcoal/30 backdrop-blur z-10">
            <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full shadow-[0_0_8px] transition-colors duration-500 ${isGenerating ? 'bg-green-500 shadow-green-500/60' : 'bg-gray-600 shadow-transparent'}`}></div>
                <span className="text-sm font-mono text-gray-400">
                    STATUS: {isGenerating ? 'SYNTHESIZING' : 'IDLE'}
                </span>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Count</p>
                    <p className="text-sm font-mono text-white">{generatedCount} / {targetTotal}</p>
                </div>
                {prompts.length > 0 && (
                    <button onClick={handleDownload} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors border border-gray-700" title="Download JSON">
                        <IconDownload className="w-5 h-5" />
                    </button>
                )}
            </div>
         </header>

         {/* Grid Content */}
         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
            <div className="fixed inset-0 pointer-events-none opacity-[0.02]" 
                style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px', left: '480px'}}>
            </div>

            <div className="max-w-5xl mx-auto space-y-6 relative z-0 pb-32">
                <div ref={topRef} />
                
                {error && (
                    <div className="w-full p-4 border border-red-500/30 bg-red-900/10 text-red-400 rounded-lg font-mono text-sm flex items-center justify-between">
                        <span>[ERROR SYSTEM]: {error}</span>
                        {authError && (
                            <button 
                                onClick={reEnterKey}
                                className="px-3 py-1 bg-red-800/50 hover:bg-red-700 rounded text-xs text-white uppercase font-bold tracking-wider"
                            >
                                Authenticate
                            </button>
                        )}
                    </div>
                )}

                {/* Empty State & START BUTTON */}
                {!isGenerating && prompts.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center h-[60vh] select-none">
                        <div className="w-24 h-24 border border-dashed border-gray-600 rounded-full flex items-center justify-center mb-6 opacity-50">
                            <IconMusaic className="w-12 h-12 grayscale opacity-50" />
                        </div>
                        <h2 className="text-xl font-light tracking-widest uppercase opacity-70">Ready for Initialization</h2>
                        <p className="text-sm font-mono mt-4 text-gray-500 max-w-md text-center mb-8">
                            Configure parameters, analyze imagery, and begin the generation sequence.
                        </p>
                        <button
                            onClick={handleGenerateBatch}
                            disabled={!description && taskType !== 'generic'}
                            className={`group relative px-8 py-4 bg-musaicPurple hover:bg-blue-600 text-white rounded-lg font-bold tracking-widest uppercase text-sm transition-all hover:scale-105 shadow-[0_0_20px_rgba(139,92,246,0.3)] ${
                                !description && taskType !== 'generic' ? 'opacity-50 grayscale cursor-not-allowed' : ''
                            }`}
                        >
                            <span className="flex items-center gap-3">
                                Initialize Generation
                                <IconSparkles className="w-5 h-5" />
                            </span>
                        </button>
                         {(!description && taskType !== 'generic') && (
                            <p className="text-[10px] text-red-400 mt-4 font-mono">
                                * Requires Physical Analysis or Generic Mode
                            </p>
                        )}
                        {!apiKey && (
                            <p className="text-[10px] text-yellow-500 mt-2 font-mono uppercase tracking-wide">
                                Demo Mode: Generation Disabled
                            </p>
                        )}
                    </div>
                )}

                {/* Prompts List - Current Page Only */}
                <div className="grid grid-cols-1 gap-4">
                    {currentPrompts.map((prompt, idx) => (
                        <div key={prompt.id} className="animate-fade-in-up" style={{animationDelay: `${(idx % 10) * 50}ms`}}>
                             <PromptCard 
                                prompt={prompt} 
                                onUpdate={(id, txt) => setPrompts(p => p.map(item => item.id === id ? {...item, text: txt} : item))}
                                onToggleCopy={handleToggleCopy}
                                isCopied={!!prompt.isCopied}
                            />
                        </div>
                    ))}
                </div>

                {/* Bottom Pagination Control Bar */}
                {prompts.length > 0 && (
                    <div className="sticky bottom-8 left-0 right-0 flex justify-center z-50">
                        <div className="bg-charcoal/90 backdrop-blur-md border border-gray-700 rounded-full shadow-2xl p-2 flex items-center gap-4">
                            
                            {/* Prev Page */}
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-3 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <IconArrowLeft className="w-5 h-5 text-gray-300" />
                            </button>

                            {/* Page Indicator */}
                            <div className="px-4 text-center">
                                <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest">Page</span>
                                <span className="font-mono text-white">{currentPage} <span className="text-gray-600">/</span> {totalPages}</span>
                            </div>

                            {/* Next Page or Generate Button */}
                            {currentPage < totalPages ? (
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="p-3 rounded-full hover:bg-gray-700 transition-all text-gray-300"
                                >
                                    <IconArrowRight className="w-5 h-5" />
                                </button>
                            ) : (
                                generatedCount < targetTotal ? (
                                    <button
                                        onClick={handleGenerateBatch}
                                        disabled={isGenerating || (!description && taskType !== 'generic')}
                                        className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs tracking-widest uppercase transition-all ${
                                            isGenerating || (!description && taskType !== 'generic')
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-musaicPurple hover:bg-blue-600 text-white hover:scale-105'
                                        }`}
                                    >
                                        {isGenerating ? (
                                            <>Synthesizing...</>
                                        ) : (
                                            <>Generate Next {Math.min(ITEMS_PER_PAGE, targetTotal - generatedCount)} <IconSparkles className="w-4 h-4" /></>
                                        )}
                                    </button>
                                ) : (
                                    <div className="px-6 py-2 bg-green-900/50 text-green-400 rounded-full text-xs font-mono border border-green-500/20">
                                        COMPLETE
                                    </div>
                                )
                            )}

                        </div>
                    </div>
                )}
            </div>
         </div>
      </main>
    </div>
  );
}