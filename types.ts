
export type TaskType = 'generic' | 'lora' | 'product';
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
}

export interface AnalysisResult {
  physical_profile: string;
  identity_inference: IdentityContext;
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

export interface VisionStructOutput {
  meta: any;
  global_context: any;
  color_palette: any;
  composition: any;
  objects: any[];
  text_ocr: any;
  semantic_relationships: any[];
}
