
export type TaskType = 'lora' | 'product' | 'ugc';
export type SafetyMode = 'sfw' | 'nsfw';

export interface PromptItem {
  id: string;
  text: string;
  tags: string[];
  isCopied?: boolean;
  generationMeta?: {
    type: string;
    index: number;
    total: number;
    label: string;
  };
}

export interface IdentityContext {
  name: string;
  age_estimate: string;
  profession: string;
  backstory: string;
} // Used for Realism Stack in LoRA mode

export interface AnalysisResult {
  identity_profile: {
    uid: string;
    age_estimate: string;
    archetype_anchor: string;
    facial_description: string;
    body_stack: string;
    realism_stack: string;
  }
}

export interface UGCSettings {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'general';
  customInstruction: string;
}

export interface SavedInfluencer {
  id: string;
  timestamp: number;
  identity: IdentityContext;
  physical_profile: string;
}

export interface GeneratorState {
  isGenerating: boolean;
  isAnalyzing: boolean;
  prompts: PromptItem[];
  generatedCount: number;
  error: string | null;
}
