import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { analyzeImageWithDirective, analyzeSubjectImages, listAvailableModels, generateDatasetPrompts, sanitizePrompt } from './services/geminiService';
import { generateImage, ImageAspect, ImageProvider } from './services/imageGenerationService';
import { PromptCard } from './components/PromptCard';
import { SplashScreen } from './components/SplashScreen';
import { IconSparkles, IconDownload, IconRefresh, IconProduct, IconFlame, IconArrowLeft, IconArrowRight, IconTrash, IconUser, IconHistory, IconPackage, IconPlus, IconKey, IconCheck, IconEdit } from './components/Icons';

import { PromptItem, TaskType, SafetyMode, IdentityContext, SavedInfluencer, UGCSettings, UGCMode, VisionStruct } from './types';

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
const STORAGE_KEY_DRAFT = 'musaic_draft_state_v2';

export default function App() {
    // --- Auth State ---
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [wavespeedApiKey, setWavespeedApiKey] = useState<string>('');
    const [showSplash, setShowSplash] = useState(true);

    // --- Configuration State ---
    const [taskType, setTaskType] = useState<TaskType>('lora');
    const [ugcMode, setUgcMode] = useState<'replicator' | 'injector' | 'creator'>('replicator');
    const [ugcGenerationType, setUgcGenerationType] = useState<'replicate' | 'inject' | 'social_prompt'>('replicate');
    const [ugcSettings, setUgcSettings] = useState<UGCSettings>({ platform: 'instagram', customInstruction: '', modelId: 'gemini-2.5-flash' });
    const [ugcCustomInstruction, setUgcCustomInstruction] = useState('');
    const [safetyMode, setSafetyMode] = useState<SafetyMode>('sfw');
    const [taskTargets, setTaskTargets] = useState<{ [key in TaskType]: number }>({ lora: 100, product: 25, ugc: 5 });
    const targetTotal = taskTargets[taskType];
    const setTargetTotal = (val: number) => setTaskTargets(prev => ({ ...prev, [taskType]: val }));

    // --- Image Generation State ---
    const [workflowMode, setWorkflowMode] = useState<'manual' | 'api'>('manual');
    const [generationMode, setGenerationMode] = useState<'dataset' | 'image'>('dataset');
    const [imageProvider, setImageProvider] = useState<ImageProvider>('google');
    const [aspectRatio, setAspectRatio] = useState<ImageAspect>('1:1');
    const [resolution, setResolution] = useState<'2k' | '4k'>('2k'); // Default to 2k (Standard)

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
    const [targetImage, setTargetImage] = useState<string | null>(null);
    const [productImages, setProductImages] = useState<(string | null)[]>([null, null, null]);
    const [analyzedScene, setAnalyzedScene] = useState<VisionStruct | null>(null);
    const [pendingAction, setPendingAction] = useState<'replica' | 'injection' | null>(null);

    // Effect to handle pending actions after analysis completes
    useEffect(() => {
        if (analyzedScene && pendingAction) {
            handleGenerateUGC();
            setPendingAction(null);
        }
    }, [analyzedScene, pendingAction]);

    // --- Output State ---
    const [prompts, setPrompts] = useState<PromptItem[]>([]);
    const [generatedImages, setGeneratedImages] = useState<{ id: string, b64_json: string }[]>([]);
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
            const draft = { taskType, safetyMode, taskTargets, description, identity };
            localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));
        }
    }, [taskType, safetyMode, taskTargets, description, identity, showSplash]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY_DRAFT);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.taskType) setTaskType(parsed.taskType);
                if (parsed.safetyMode) setSafetyMode(parsed.safetyMode);
                if (parsed.taskTargets) setTaskTargets(parsed.taskTargets);
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
            setTargetImage(null);
            setAnalyzedScene(null);
            setProductImages([null, null, null]);
            setDescription('');
            setIdentity({ name: '', age_estimate: '', profession: '', backstory: '' });
            setIdentity({ name: '', age_estimate: '', profession: '', backstory: '' });
            setTaskTargets({ lora: 100, product: 25, ugc: 5 });
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

    // --- Zip Logic ---
    const handleDownloadZip = async () => {
        if (generatedImages.length === 0) return;
        const zip = new JSZip();

        // Naming Logic: CharName_Batch_Date
        let baseName = "Musaic_Batch";
        if (identity.name) baseName = identity.name.replace(/[^a-z0-9]/gi, '_'); // fallback to identity
        // Try to get from VisionStruct if identity is empty
        if ((!identity.name || identity.name === 'Subject') && analyzedScene?.subject_core?.identity) {
            const match = analyzedScene.subject_core.identity.match(/looks just like ([^']+)/i);
            if (match) baseName = match[1].replace(/[^a-z0-9]/gi, '_');
        }

        const folderName = `${baseName}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const folder = zip.folder(folderName);
        if (!folder) return;

        generatedImages.forEach((img, idx) => {
            const b64 = img.b64_json.replace(/^data:image\/\w+;base64,/, "");
            folder.file(`${baseName}_${idx + 1}.png`, b64, { base64: true });
        });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${folderName}.zip`);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'head' | 'body' | 'product' | 'target', index: number = 0) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const target = e.target;
        try {
            const base64 = await fileToBase64(file);
            if (type === 'head') setHeadshot(base64);
            else if (type === 'body') setBodyshot(base64);
            else if (type === 'target') setTargetImage(base64);
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

    const handleAnalyzeScene = async () => {
        if (!targetImage) return;
        setIsGenerating(true);
        setError(null);
        try {
            // Use the user-defined model ID
            const sceneAnalysis: VisionStruct = await analyzeImageWithDirective(targetImage, ugcSettings.modelId);
            setAnalyzedScene(sceneAnalysis);
        } catch (e: any) {
            handleApiError(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateReplica = () => {
        if (!analyzedScene) {
            setPendingAction('replica');
            handleAnalyzeScene();
            return;
        }

        // REPLICA LOGIC:
        // User requested to "explicitly exclude facial descriptions".
        // We strip facial_features and makeup, but keep hair and identity (body type).
        const replicaJSON = JSON.parse(JSON.stringify(analyzedScene));
        if (replicaJSON.subject_core) {
            // @ts-ignore
            delete replicaJSON.subject_core.facial_features;
            // @ts-ignore
            delete replicaJSON.subject_core.makeup;
        }

        const newPrompt: PromptItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: JSON.stringify(replicaJSON),
            tags: ['REPLICATOR', 'VISIONSTRUCT'],
            generationMeta: {
                type: 'SCENE REPLICA',
                index: generatedCount + 1,
                total: targetTotal,
                label: 'Forensic Scan'
            }
        };
        setPrompts(prev => [newPrompt, ...prev]);
        setGeneratedCount(prev => prev + 1);
        // setAnalyzedScene(null); // Keep scene for multiple generations
    };

    const handleGenerateUGC = async () => {
        if (ugcGenerationType === 'social_prompt') {
            // SOCIAL MODE (Text-to-Prompt)
            setIsGenerating(true);
            setError(null);
            try {
                const newPrompts = await generateDatasetPrompts({
                    taskType: 'ugc',
                    subjectDescription: 'Generic', // Not used in social mode
                    identity: { name: 'Social', profession: 'Influencer', backstory: 'None', age_estimate: '25' }, // Not used
                    safetyMode,
                    count: targetTotal,
                    startCount: generatedCount,
                    totalTarget: targetTotal,
                    ugcSettings: { ...ugcSettings, mode: 'social_prompt', customInstruction: ugcCustomInstruction }
                });

                setPrompts(prev => [...newPrompts, ...prev]);
                setGeneratedCount(prev => prev + newPrompts.length);
            } catch (e: any) {
                console.error(e);
                setError(e.message || "Generation failed");
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        if (!analyzedScene) {
            // Map the local state types to the pendingAction types
            setPendingAction(ugcGenerationType === 'replicate' ? 'replica' : 'injection');
            handleAnalyzeScene();
            return;
        }

        const finalPromptJSON = JSON.parse(JSON.stringify(analyzedScene)); // Deep copy

        if (ugcGenerationType === 'replicate') {
            // REPLICATE MODE:
            // Keep EVERYTHING. Do not strip facial features.
            // The user wants a full forensic replication of the source image.
            // No deletions.
        } else {
            // INJECT MODE:
            // Aggressively strip physical attributes to prevent "Identity Drift".
            // We want the model to use the Reference Image (external) for the face/body,
            // and the Prompt for the Scene/Pose/Clothes.

            if (finalPromptJSON.subject_core) {
                // @ts-ignore
                delete finalPromptJSON.subject_core.identity;
                // @ts-ignore
                delete finalPromptJSON.subject_core.styling;
                // @ts-ignore
                delete finalPromptJSON.subject_core.imperfections;
            }
        }

        const newPrompt: PromptItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: JSON.stringify(finalPromptJSON),
            tags: ['VISIONSTRUCT', ugcGenerationType === 'replicate' ? 'REPLICA' : 'INJECTION'],
            generationMeta: {
                type: ugcGenerationType === 'replicate' ? 'SCENE REPLICA' : 'CHARACTER INJECTION',
                index: generatedCount + 1,
                total: targetTotal,
                label: ugcGenerationType === 'replicate' ? 'Full Scene Replication' : 'Character Injection'
            }
        };
        setPrompts(prev => [newPrompt, ...prev]);
        setGeneratedCount(prev => prev + 1);
    };

    const handleGenerateInjection = () => {
        if (!analyzedScene) {
            setPendingAction('injection');
            handleAnalyzeScene();
            return;
        }
        // Check if we have a reference image (either from history or new upload)
        // For now, we rely on the 'identity' state being populated, OR a new upload if we add that feature.
        // But per new design, we want a direct upload. 
        // Let's assume the user has selected a subject or uploaded one.
        if (!description && !headshot && !bodyshot) {
            setError("Please upload a character reference image.");
            return;
        }

        const finalPromptJSON = JSON.parse(JSON.stringify(analyzedScene)); // Deep copy

        // CRITICAL INJECTION LOGIC:
        // Aggressively strip physical attributes to prevent "Identity Drift".
        // We want the model to use the Reference Image for the face/body, 
        // and the Prompt for the Scene/Pose/Clothes.

        if (finalPromptJSON.subject_core) {
            // @ts-ignore
            delete finalPromptJSON.subject_core.identity;
            // @ts-ignore
            delete finalPromptJSON.subject_core.facial_features;
            // @ts-ignore
            delete finalPromptJSON.subject_core.hair;
            // @ts-ignore
            delete finalPromptJSON.subject_core.makeup;
            // @ts-ignore
            delete finalPromptJSON.subject_core.styling; // Remove generic styling if present
        }

        // We explicitly RETAIN:
        // - expression (Mood/Gaze)
        // - anatomical_details (Pose/Spine/Hands)
        // - attire_mechanics (Clothing/Fit) -> CRITICAL: User requested to keep clothes.
        // - environment_and_depth (Scene)

        const newPrompt: PromptItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: JSON.stringify(finalPromptJSON),
            tags: ['INJECTOR', 'VISIONSTRUCT'],
            generationMeta: {
                type: 'CHARACTER INJECTION',
                index: generatedCount + 1,
                total: targetTotal,
                label: `Injecting Character`
            }
        };
        setPrompts(prev => [newPrompt, ...prev]);
        setGeneratedCount(prev => prev + 1);
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

    const [batchStatus, setBatchStatus] = useState<string | null>(null);

    // Unified API Job: Generate Prompts -> Generate Images in chunks
    const handleStartApiJob = async () => {
        const keyToUse = imageProvider === 'wavespeed' ? wavespeedApiKey : apiKey;
        if (imageProvider === 'google' && !apiKey) { setError("Google API Key required."); return; }
        if (imageProvider === 'wavespeed' && !wavespeedApiKey) { setError("Wavespeed API Key required."); return; }

        if (!description && taskType !== 'ugc') {
            setError("Subject Analysis required for LoRA/Product tasks.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setAuthError(false);
        setBatchStatus("Initializing Batch...");

        // Local state trackers to avoid closure staleness
        let localGeneratedCount = generatedCount;
        let localUsedSettings = [...usedSettings];
        const retryQueue: PromptItem[] = [];
        let needed = targetTotal - localGeneratedCount;
        let jobFailures = 0;

        try {
            while (needed > 0) {
                setBatchStatus(`Processing ${localGeneratedCount}/${targetTotal} Images`);

                // 1. Generate Prompts Batch
                const CHUNK_SIZE = 5;
                const currentBatchSize = Math.min(CHUNK_SIZE, needed);

                const newPrompts = await generateDatasetPrompts({
                    taskType,
                    subjectDescription: description,
                    identity,
                    safetyMode,
                    productImages: productImages.filter(img => img !== null) as string[],
                    count: currentBatchSize,
                    startCount: localGeneratedCount,
                    totalTarget: targetTotal,
                    ugcSettings,
                    previousSettings: localUsedSettings
                });

                if (!newPrompts || newPrompts.length === 0) {
                    throw new Error("AI stopped generating prompts.");
                }

                // Update Local Settings Tracker for Anti-Repetition
                newPrompts.forEach(p => {
                    try {
                        const cleaned = p.text.replace(/```json\n ?| ```/g, '').trim();
                        const json = JSON.parse(cleaned);
                        if (json.background?.setting) {
                            localUsedSettings.push(json.background.setting);
                        }
                    } catch (e) { }
                });

                // Update UI with new prompts
                setPrompts(prev => [...prev, ...newPrompts]);

                setBatchStatus(`Synthesizing Images... (${localGeneratedCount + newPrompts.length}/${targetTotal})`);

                // 2. Generate Images for this batch immediately
                const currentBatchFailures = await processImageBatch(newPrompts, keyToUse || apiKey || '');

                // Update counters
                localGeneratedCount += newPrompts.length;
                setGeneratedCount(prev => prev + newPrompts.length); // Update UI state
                setUsedSettings([...localUsedSettings]); // Update UI state

                needed -= newPrompts.length;

                // Capture Failures for Retry
                if (currentBatchFailures.failedItems.length > 0) {
                    // Broaden Retry: Retry ALL failures.
                    // The user said "utilize it whenever... rejected".
                    // So we take all failed items.
                    retryQueue.push(...currentBatchFailures.failedItems.map(f => f.item));
                }
                jobFailures += currentBatchFailures.totalFailed;

                // Short pause to allow UI to breathe/render
                await new Promise(r => setTimeout(r, 500));
            }

            // --- SAFETY RETRY PHASE ---
            if (retryQueue.length > 0) {
                setBatchStatus(`Attempting Safety Retry for ${retryQueue.length} items...`);
                // Sanitize Prompts
                const sanitizedItems: PromptItem[] = [];

                for (const item of retryQueue) {
                    const cleanText = await sanitizePrompt(item.text);
                    sanitizedItems.push({ ...item, text: cleanText, id: item.id + "_retry" });
                }

                // Process Retry Batch
                const retryResult = await processImageBatch(sanitizedItems, keyToUse || apiKey || '');
                jobFailures = jobFailures - (retryQueue.length - retryResult.totalFailed); // Adjust failure count if success
                if (retryResult.totalFailed === 0) {
                    // All retries succeeded!
                }
            }

            if (jobFailures > 0) {
                setError(`Job complete with ${jobFailures} failures.`);
                setBatchStatus(`Completed with errors.`);
            } else {
                setBatchStatus("Batch Complete");
            }

        } catch (e: any) {
            handleApiError(e);
            setBatchStatus("Failed");
        } finally {
            setIsGenerating(false);
            // Don't clear batch status immediately so user sees "Batch Complete"
        }
    };

    // Helper for generating images from a specific list of prompts
    const processImageBatch = async (batchPrompts: PromptItem[], apiToken: string): Promise<{ totalFailed: number, failedItems: { item: PromptItem, error: string }[] }> => {
        let failures = 0;
        const failedItems: { item: PromptItem, error: string }[] = [];

        await Promise.all(batchPrompts.map(async (p) => {
            try {
                const hasRefs = [headshot, bodyshot].filter(Boolean).length > 0;
                let finalPrompt = p.text;

                if (hasRefs) {
                    try {
                        const json = JSON.parse(p.text);
                        // SILENT FACE PROTOCOL: Strip facial data to force API to use Reference Image
                        if (json.subject) {
                            delete json.subject.face;
                            // @ts-ignore
                            delete json.subject.facial_features;
                            delete json.subject.hair;
                            // Keep expression if needed, but sometimes it conflicts too. 
                            // Let's keep expression for mood, but delete physicals.
                            if (json.subject.imperfections) {
                                delete json.subject.imperfections.hair;
                            }
                        }
                        finalPrompt = JSON.stringify(json);
                    } catch (e) { /* Not JSON or failed to parse, use raw text */ }
                }

                const res = await generateImage({
                    provider: imageProvider,
                    apiKey: apiToken,
                    prompt: finalPrompt,
                    aspectRatio,
                    referenceImages: [headshot, bodyshot].filter(Boolean) as string[],
                    resolution
                });

                let base64Data = res.b64_json;

                // Handle URL-based returns (e.g. Wavespeed/Replicate sometimes)
                if (res.ok && res.url && !base64Data) {
                    try {
                        const imgRes = await fetch(res.url);
                        const blob = await imgRes.blob();
                        base64Data = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve((reader.result as string).split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) { console.error("URL fetch failed", e); }
                }

                if (res.ok && base64Data) {


                    // Web App Mode: Store in memory
                    setGeneratedImages(prev => [...prev, { id: p.id, b64_json: base64Data || "" }]);
                } else {
                    failures++;
                    console.error(`Failed: ${p.id}`, res.error);
                    failedItems.push({ item: p, error: res.error || "Unknown Error" });
                }
            } catch (e: any) {
                failures++;
                console.error(e);
                failedItems.push({ item: p, error: e.message || "Exception" });
            }
        }));
        return { totalFailed: failures, failedItems };
    };

    const handleGenerateImages = async () => {
        // Legacy manual trigger - reuses processImageBatch but for ALL prompts
        // For now, let's keep the old logic or redirect to use processImageBatch? 
        // We'll keep the old one as is for safety, or we can refactor.
        // Let's refactor to use the new helper for consistency.
        const keyToUse = imageProvider === 'wavespeed' ? wavespeedApiKey : apiKey;
        if (!keyToUse) { setError("API Key required."); return; }

        setIsGenerating(true);
        setError(null);

        try {
            // Process in chunks of 5
            for (let i = 0; i < prompts.length; i += 5) {
                const batch = prompts.slice(i, i + 5);
                await processImageBatch(batch, keyToUse);
            }
            alert("Manual Generation Complete.");
        } catch (e: any) {
            setError(e.message);
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
                            <img src="splash.png" alt="Musaic" className="w-12 h-12 object-contain filter drop-shadow-md mix-blend-screen" />
                            <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-musaicGold to-musaicPurple bg-clip-text text-transparent">MUSAIC</h1>
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
                                    <button key={t} onClick={() => { if (taskType !== t) triggerResetFlow(t); }} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-all rounded-xl flex flex-col items-center justify-center gap-0.5 ${taskType === t ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white shadow-inner border border-gray-600' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'} `}>
                                        <span>{t === 'ugc' ? 'UGC / Social' : t}</span>
                                        {t === 'ugc' && <span className="text-[9px] opacity-60 font-normal normal-case tracking-normal">Lifestyle & Content</span>}
                                    </button>
                                ))}
                            </div>

                            <section className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-musaicPurple"></span>Context</h2>
                                    {(taskType === 'product' || taskType === 'lora') && !isSelectingInfluencer && (
                                        <button onClick={() => setIsSelectingInfluencer(!isSelectingInfluencer)} className="text-[10px] text-musaicGold hover:underline flex items-center gap-1"><IconHistory className="w-3 h-3" />History</button>
                                    )}
                                </div>

                                {/* UGC OVERHAUL UI */}
                                {taskType === 'ugc' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">

                                        <div className="flex justify-between items-center mb-4">
                                            {/* Model Selector */}
                                            <div className="relative group ml-auto">
                                                <input
                                                    type="text"
                                                    value={ugcSettings.modelId}
                                                    onChange={(e) => setUgcSettings({ ...ugcSettings, modelId: e.target.value })}
                                                    className="w-32 bg-black/20 border border-gray-800 rounded px-2 py-1 text-[9px] text-gray-500 focus:text-white focus:border-gray-600 outline-none text-right transition-all"
                                                    placeholder="Model ID"
                                                    title="Gemini Model ID (e.g. gemini-1.5-pro-001)"
                                                />
                                                <div className="absolute right-0 -bottom-4 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-gray-600 whitespace-nowrap pointer-events-none">
                                                    Model ID
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const models = await listAvailableModels();
                                                        if (models.length > 0) {
                                                            alert("Available Models:\n" + models.join("\n"));
                                                            const flash = models.find(m => m.includes('flash'));
                                                            if (flash) setUgcSettings(prev => ({ ...prev, modelId: flash }));
                                                        } else {
                                                            alert("No models found or failed to list.");
                                                        }
                                                    } catch (e) {
                                                        alert("Error listing models: " + e);
                                                    }
                                                }}
                                                className="ml-2 p-1.5 bg-gray-800 rounded text-[10px] text-gray-400 hover:text-white hover:bg-gray-700"
                                                title="List Available Models"
                                            >
                                                <IconProduct className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* Target Image Upload (Always Visible) */}
                                        {(ugcMode === 'replicator' || ugcMode === 'injector') && (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 flex justify-between">
                                                        <span>Target Scene</span>
                                                        <span className="text-musaicGold">Upload Required for Replicate/Inject</span>
                                                    </label>
                                                    <div className={`relative h-48 rounded-2xl border-2 overflow-hidden transition-all ${targetImage ? 'border-musaicPurple' : 'border-dashed border-gray-700 hover:border-gray-500 bg-black/20'} `}>
                                                        {targetImage ? (
                                                            <>
                                                                <img src={targetImage} alt="Target" className="w-full h-full object-cover" />
                                                                <button onClick={() => setTargetImage(null)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors"><IconTrash className="w-4 h-4" /></button>
                                                            </>
                                                        ) : (
                                                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                                                                <div className="p-4 rounded-full bg-gray-800/50 group-hover:bg-gray-700/50 transition-colors mb-2">
                                                                    <IconSparkles className="w-6 h-6 text-gray-400 group-hover:text-white" />
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-400 group-hover:text-white">Upload Image to Replicate</span>
                                                                <span className="text-[9px] text-gray-600 mt-1 text-center px-4">Upload Image to access Replicate Source Subject and Inject External Character</span>
                                                                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleImageUpload(e, 'target')} className="hidden" />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Generation Options (Radio Buttons) */}
                                                <div className="grid grid-cols-1 gap-3">
                                                    <label className={`relative flex items-center p-4 rounded-xl border-2 transition-all ${!targetImage ? 'opacity-50 cursor-not-allowed border-gray-800 bg-gray-900' : ugcGenerationType === 'replicate' ? 'border-musaicGold bg-musaicGold/10 cursor-pointer' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 cursor-pointer'}`}>
                                                        <input
                                                            type="radio"
                                                            name="ugcType"
                                                            value="replicate"
                                                            checked={ugcGenerationType === 'replicate'}
                                                            onChange={() => setUgcGenerationType('replicate')}
                                                            disabled={!targetImage}
                                                            className="w-4 h-4 text-musaicGold border-gray-600 focus:ring-musaicGold bg-gray-700 disabled:opacity-50"
                                                        />
                                                        <div className="ml-3">
                                                            <span className="block text-sm font-bold text-white">Replicate Source Subject</span>
                                                            <span className="block text-xs text-gray-400">Full forensic clone (Face, Body, Clothes, Scene)</span>
                                                        </div>
                                                    </label>

                                                    <label className={`relative flex items-center p-4 rounded-xl border-2 transition-all ${!targetImage ? 'opacity-50 cursor-not-allowed border-gray-800 bg-gray-900' : ugcGenerationType === 'inject' ? 'border-musaicPurple bg-musaicPurple/10 cursor-pointer' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 cursor-pointer'}`}>
                                                        <input
                                                            type="radio"
                                                            name="ugcType"
                                                            value="inject"
                                                            checked={ugcGenerationType === 'inject'}
                                                            onChange={() => setUgcGenerationType('inject')}
                                                            disabled={!targetImage}
                                                            className="w-4 h-4 text-musaicPurple border-gray-600 focus:ring-musaicPurple bg-gray-700 disabled:opacity-50"
                                                        />
                                                        <div className="ml-3">
                                                            <span className="block text-sm font-bold text-white">Inject External Character</span>
                                                            <span className="block text-xs text-gray-400">Keep Scene/Pose/Clothes. Strip Identity.</span>
                                                        </div>
                                                    </label>

                                                    <label className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${ugcGenerationType === 'social_prompt' ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                                                        <input
                                                            type="radio"
                                                            name="ugcType"
                                                            value="social_prompt"
                                                            checked={ugcGenerationType === 'social_prompt'}
                                                            onChange={() => setUgcGenerationType('social_prompt')}
                                                            className="w-4 h-4 text-indigo-500 border-gray-600 focus:ring-indigo-500 bg-gray-700"
                                                        />
                                                        <div className="ml-3">
                                                            <span className="block text-sm font-bold text-white">Create Social Media Style Prompts</span>
                                                            <span className="block text-xs text-gray-400">Text-to-Prompt. Describe Vibe/Outfit.</span>
                                                        </div>
                                                    </label>
                                                </div>

                                                {/* Social Mode Inputs */}
                                                {ugcGenerationType === 'social_prompt' && (
                                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                                                                Custom Instructions
                                                            </label>
                                                            <textarea
                                                                value={ugcCustomInstruction}
                                                                onChange={(e) => setUgcCustomInstruction(e.target.value)}
                                                                placeholder="Describe the location, pose, clothing, and vibe (e.g., 'Outfit of the day, standing in a coffee shop...')"
                                                                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-24 resize-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                                    Batch Size
                                                                </label>
                                                                <span className="text-xs text-indigo-400 font-bold">{targetTotal}</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="1"
                                                                max="10"
                                                                value={targetTotal}
                                                                onChange={(e) => setTargetTotal(parseInt(e.target.value))}
                                                                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[9px] uppercase font-bold text-gray-500">Quality</label>
                                                            <select value={resolution} onChange={(e) => setResolution(e.target.value as '2k' | '4k')} className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none appearance-none cursor-pointer">
                                                                <option value="2k">2K (Standard)</option>
                                                                <option value="4k">4K (Ultra)</option>
                                                            </select>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[9px] uppercase font-bold text-gray-500">Aspect Ratio</label>
                                                            <div className="grid grid-cols-5 gap-1">
                                                                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as ImageAspect[]).map((r) => (
                                                                    <button
                                                                        key={r}
                                                                        onClick={() => setAspectRatio(r)}
                                                                        className={`py-2 text-[10px] font-medium rounded-lg border transition-all ${aspectRatio === r ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                                                    >
                                                                        {r}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Generate Button */}
                                                <button
                                                    onClick={handleGenerateUGC}
                                                    disabled={isGenerating || (ugcGenerationType !== 'social_prompt' && !targetImage)}
                                                    className={`w-full py-4 rounded-xl font-bold uppercase text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 ${isGenerating || (ugcGenerationType !== 'social_prompt' && !targetImage)
                                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                        : ugcGenerationType === 'social_prompt'
                                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-indigo-500/25'
                                                            : ugcGenerationType === 'replicate'
                                                                ? 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white hover:shadow-yellow-500/25'
                                                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-purple-500/25'
                                                        }`}
                                                >
                                                    {isGenerating ? (
                                                        <><span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>Analyzing...</>
                                                    ) : (
                                                        <>
                                                            <IconSparkles className="w-5 h-5" />
                                                            {ugcGenerationType === 'social_prompt' ? 'Generate Social Media Prompts' :
                                                                ugcGenerationType === 'replicate' ? 'Generate Replica Prompt' : 'Generate Injection Prompt'}
                                                        </>
                                                    )}
                                                </button>

                                                <div className="pt-4 border-t border-gray-800/50">
                                                    <button
                                                        onClick={() => handleSessionReset(false)}
                                                        className="w-full py-2 bg-gray-800/50 hover:bg-red-900/20 text-gray-500 hover:text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <IconTrash className="w-3 h-3" /> Reset Prompts
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Injector Context Selector */}
                                        {ugcMode === 'injector' && (
                                            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-xs font-bold text-white flex items-center gap-2"><IconUser className="w-3 h-3 text-musaicPurple" /> Subject to Inject</h3>
                                                    {!isSelectingInfluencer && <button onClick={() => setIsSelectingInfluencer(true)} className="text-[10px] text-musaicGold hover:underline">Change</button>}
                                                </div>

                                                {description ? (
                                                    <div className="text-xs text-gray-300 bg-black/20 p-2 rounded border border-white/5">
                                                        <span className="block font-bold text-white mb-1">{identity.name || "Current Subject"}</span>
                                                        <span className="line-clamp-2 opacity-70">{description}</span>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setIsSelectingInfluencer(true)} className="w-full py-3 border border-dashed border-gray-600 rounded-lg text-xs text-gray-500 hover:text-white hover:border-gray-400 transition-colors">
                                                        Select Subject from History
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Scene Match Post-Analysis Options (Legacy Block - Removed) */}
                                        {/* Content moved above */}

                                        {ugcMode === 'creator' && false && (
                                            <div className="p-4 bg-gray-800 rounded-xl">
                                                <p className="text-gray-500">Creator Mode Placeholder</p>
                                            </div>
                                        )}
                                    </div>
                                )}

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
                                    // Identity Details Block (kept here or can be moved up, user requested Ref Images at top)
                                    // I moved Identity Details up in the previous step, so removing duplicates here 
                                    <></>
                                )}

                                {taskType === 'product' && (
                                    <div className="pt-4 border-t border-gray-800 space-y-3">
                                        <label className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><IconPackage className="w-4 h-4" /> Product Assets</label>
                                        <div className="flex gap-2">
                                            {[0, 1, 2].map((idx) => (
                                                <div key={idx} className={`relative flex-1 h-20 rounded-xl border border-dashed border-gray-700 bg-black/20 overflow-hidden hover:border-gray-500 transition-colors`}>
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

                            <section className="space-y-6">
                                <div className="space-y-4">
                                    <h2 className="text-xs font-bold text-musaicPurple uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-musaicPurple"></span>Dataset Configuration</h2>

                                    {/* Workflow Mode Selector */}
                                    <div className="bg-gray-800 rounded-xl p-1 grid grid-cols-2 gap-1 mb-6">
                                        <button
                                            onClick={() => setWorkflowMode('manual')}
                                            className={`py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${workflowMode === 'manual' ? 'bg-musaicPurple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <IconEdit className="w-4 h-4" /> Manual Control
                                        </button>
                                        <button
                                            onClick={() => setWorkflowMode('api')}
                                            className={`py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${workflowMode === 'api' ? 'bg-musaicGold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <IconSparkles className="w-4 h-4" /> Auto / API Phase
                                        </button>
                                    </div>

                                    {/* Reference Images (Shared) */}
                                    <div className="space-y-3">
                                        <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg flex gap-3">
                                            <IconUser className="w-5 h-5 text-blue-400 shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Context References</p>
                                                <p className="text-[10px] text-gray-400 leading-relaxed">Provide a clear Headshot for facial identity and a Full Body shot for physique/style. The AI uses these to maintain consistency across the dataset.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Headshot</label>
                                                <div className={`relative h-32 rounded-2xl border-2 overflow-hidden transition-all ${headshot ? 'border-musaicPurple' : 'border-dashed border-gray-700 hover:border-gray-500 bg-black/20'} `}>
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
                                                <div className={`relative h-32 rounded-2xl border-2 overflow-hidden transition-all ${bodyshot ? 'border-musaicPurple' : 'border-dashed border-gray-700 hover:border-gray-500 bg-black/20'} `}>
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
                                    </div>

                                    {/* Analyze Button */}
                                    <button onClick={handleAnalyze} disabled={isAnalyzing || (!headshot && !bodyshot)} className={`w-full py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${isAnalyzing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-musaicPurple hover:to-blue-600 text-white shadow-lg'} `}>
                                        {isAnalyzing ? <><IconRefresh className="w-4 h-4 animate-spin" /> Analyzing...</> : <><IconSparkles className="w-4 h-4 text-musaicGold" /> Analyze Profile</>}
                                    </button>

                                    {/* Identity Details & Reset */}
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

                                    {/* Workflow Specific: Manual */}
                                    {workflowMode === 'manual' && (
                                        <div className="space-y-3 pt-4 border-t border-gray-800 animate-fade-in-up">
                                            <div className="flex justify-between text-xs font-mono text-gray-400"><span>Target Count</span><span className="text-white">{targetTotal} Prompts</span></div>
                                            <input type="range" min="1" max="100" step="1" value={targetTotal} onChange={(e) => setTargetTotal(Number(e.target.value))} className="w-full" />
                                            <div className="flex justify-between text-[10px] text-gray-600 font-mono"><span>1</span><span>100</span></div>

                                            <button onClick={handleGenerateBatch} disabled={isGenerating || generatedCount >= targetTotal || !description} className={`w-full py-4 rounded-xl font-bold uppercase text-sm tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] ${generatedCount >= targetTotal ? 'bg-green-600 text-white cursor-default' : isGenerating ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-gradient-to-r from-musaicPurple to-blue-600 text-white hover:shadow-musaicPurple/25'} `}>
                                                {isGenerating ? <span className="flex items-center justify-center gap-2"><span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>Synthesizing...</span> : generatedCount >= targetTotal ? <span className="flex items-center justify-center gap-2"><IconCheck className="w-5 h-5" /> Complete</span> : `Generate Prompts`}
                                            </button>
                                        </div>
                                    )}

                                    {/* Workflow Specific: API */}
                                    {workflowMode === 'api' && (
                                        <div className="space-y-4 pt-4 border-t border-gray-800 animate-fade-in-up">
                                            {/* API Settings Panel */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Provider</label>
                                                    <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value as ImageProvider)} className="w-full bg-black/30 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-musaicGold [&>option]:bg-gray-900 [&>option]:text-white">
                                                        <option value="google">Google (Nano Banana Pro)</option>
                                                        <option value="wavespeed">Wavespeed</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Quality</label>
                                                    <select value={resolution} onChange={(e) => setResolution(e.target.value as '2k' | '4k')} className="w-full bg-black/30 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-musaicGold [&>option]:bg-gray-900 [&>option]:text-white">
                                                        <option value="2k">2K (Standard)</option>
                                                        <option value="4k">4K (Ultra)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Aspect Ratio</label>
                                                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as ImageAspect)} className="w-full bg-black/30 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-musaicGold [&>option]:bg-gray-900 [&>option]:text-white">
                                                        <option value="1:1">1:1 (Square)</option>
                                                        <option value="16:9">16:9 (Landscape)</option>
                                                        <option value="9:16">9:16 (Portrait)</option>
                                                        <option value="4:3">4:3 (Desktop)</option>
                                                        <option value="3:4">3:4 (Mobile)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Batch Size</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="range" min="10" max="100" step="10" value={targetTotal < 10 ? 10 : targetTotal} onChange={(e) => setTargetTotal(Number(e.target.value))} className="w-full" />
                                                        <span className="text-xs font-mono text-white w-8 text-right">{targetTotal}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {imageProvider === 'wavespeed' && (
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 flex justify-between">Wavespeed API Key</label>
                                                    <input type="password" value={wavespeedApiKey} onChange={(e) => setWavespeedApiKey(e.target.value)} placeholder="ws-..." className="w-full bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:border-musaicPurple outline-none" />
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <button
                                                    onClick={handleStartApiJob}
                                                    disabled={isGenerating || !description || (generatedCount >= targetTotal && generatedCount > 0)}
                                                    className={`w-full py-4 rounded-xl font-bold uppercase text-sm tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] ${generatedCount >= targetTotal && generatedCount > 0 ? 'bg-green-600 text-white cursor-default' :
                                                        isGenerating ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-gradient-to-r from-musaicGold to-orange-500 text-black hover:shadow-orange-500/25'
                                                        } `}
                                                >
                                                    {generatedCount >= targetTotal && generatedCount > 0 ? (
                                                        <span className="flex items-center justify-center gap-2"><IconCheck className="w-5 h-5" /> Batch Complete</span>
                                                    ) : isGenerating ? (
                                                        <span className="flex items-center justify-center gap-2"><span className="w-2 h-2 bg-black rounded-full animate-bounce"></span>Starting Pipeline...</span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-2"><IconSparkles className="w-5 h-5" /> Submit Prompts to API</span>
                                                    )}
                                                </button>

                                                {/* Progress Bar REMOVED per user request */}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </section>
                            {(error || authError) && (
                                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-xs flex items-start gap-2 animate-fade-in"><span className="text-lg leading-none">!</span><div className="flex-1"><p>{error}</p>{authError && <button onClick={reEnterKey} className="underline hover:text-white mt-1">Re-enter API Key</button>}</div><button onClick={resetError} className="text-red-400 hover:text-white">✕</button></div>
                            )}
                        </div >

                        <div className="lg:col-span-8 bg-black/40 border border-gray-800 rounded-3xl p-6 min-h-[600px] flex flex-col relative overflow-hidden backdrop-blur-sm">
                            {workflowMode === 'api' && (isGenerating || batchStatus) ? (
                                <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-pulse">
                                    <div className="relative">
                                        <div className={`w-24 h-24 rounded-full border-4 ${batchStatus === 'Batch Complete' ? 'border-green-500 bg-green-900/20' : 'border-gray-800 bg-black/50'} flex items-center justify-center transition-colors`}>
                                            {batchStatus === 'Batch Complete' ? <IconCheck className="w-10 h-10 text-green-500" /> : <IconSparkles className="w-10 h-10 text-musaicGold animate-spin-slow" />}
                                        </div>
                                        {batchStatus !== 'Batch Complete' && <div className="absolute inset-0 rounded-full border-4 border-t-musaicGold border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>}
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white tracking-widest uppercase">{batchStatus === 'Batch Complete' ? 'Batch Completed' : 'Processing Batch'}</h3>
                                        <p className="text-sm font-mono text-musaicGold mt-2">{batchStatus || 'Initializing...'}</p>
                                        {batchStatus === 'Batch Complete' ? (
                                            <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md mx-auto space-y-3">
                                                <button
                                                    onClick={handleDownloadZip}
                                                    className="w-full py-4 bg-musaicPurple hover:bg-musaicPurple/80 text-white rounded-xl font-bold shadow-lg shadow-musaicPurple/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    <IconDownload className="w-6 h-6" /> Download Zip ({generatedImages.length} Images)
                                                </button>

                                                <button onClick={() => { if (confirm("Start a new dataset? This will clear current progress.")) handleSessionReset(false); }} className="w-full py-3 border border-dashed border-gray-600 rounded-xl text-xs font-bold uppercase text-gray-400 hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2">
                                                    <IconTrash className="w-4 h-4" /> Start New Session
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 mt-4">Images are being buffered in memory. Download available upon completion.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-baseline gap-4"><h2 className="text-2xl font-bold text-white tracking-tight">Dataset</h2><span className="font-mono text-musaicPurple text-sm">{generatedCount} / {targetTotal}</span></div>
                                        <div className="flex gap-2">
                                            {prompts.length > 0 && <button onClick={exportPrompts} className="px-4 py-2 bg-charcoal hover:bg-gray-800 text-gray-300 text-xs font-bold uppercase tracking-wide rounded-lg border border-gray-700 flex items-center gap-2 transition-colors"><IconDownload className="w-4 h-4" /> JSON</button>}
                                        </div>
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

                                        {/* Manual Mode Generate Button (Bottom List) */}
                                        {workflowMode === 'manual' && generatedCount < targetTotal && prompts.length > 0 && (
                                            <div className="pt-8 pb-4 flex justify-center">
                                                <button onClick={handleGenerateBatch} disabled={isGenerating} className={`w-full max-w-md py-4 rounded-xl font-bold uppercase text-sm tracking-widest border shadow-lg transition-all flex items-center justify-center gap-2 group ${isGenerating ? 'bg-gray-800 text-gray-500 border-gray-800 cursor-wait' : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700 hover:border-gray-500'} `}>
                                                    {isGenerating ? <><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>Synthesizing...</> : <><IconSparkles className="w-4 h-4 text-musaicGold group-hover:rotate-12 transition-transform" />Generate Next Batch ({Math.min(ITEMS_PER_PAGE, targetTotal - generatedCount)})</>}
                                                </button>
                                            </div>
                                        )}

                                        {/* API Mode Placeholder (If not generating but has prompts) */}
                                        {workflowMode === 'api' && prompts.length > 0 && (
                                            <div className="pt-8 pb-4 flex justify-center text-gray-500 font-mono text-sm">
                                                <p>Check the API Control Panel to continue.</p>
                                            </div>
                                        )}

                                        {isGenerating && workflowMode !== 'api' && <div className="space-y-4 animate-pulse opacity-50">{[1, 2].map(i => <div key={i} className="h-48 bg-gray-800/50 rounded-xl border border-gray-700/50"></div>)}</div>}
                                    </div>

                                    {prompts.length > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-between border-t border-gray-800/30">
                                            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconArrowLeft className="w-5 h-5" /></button>
                                            <span className="font-mono text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
                                            <div className="flex gap-2"><button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconArrowRight className="w-5 h-5" /></button></div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </main>
                </div>
            )}
        </>
    );
}
