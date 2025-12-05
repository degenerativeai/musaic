
declare module '*.png';

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
  modelId: string;
  mode?: 'social_prompt';
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

// VisionStruct Ultra Schema
export interface VisionStruct {
  meta: {
    medium: string;
    visual_fidelity: string;
  };
  atmosphere_and_context: {
    mood: string;
    lighting_source: string;
    shadow_play: string;
  };
  subject_core: {
    identity: string;
    styling: string;
  };
  anatomical_details: {
    posture_and_spine: string;
    limb_placement: string;
    hands_and_fingers: string;
    head_and_gaze: string;
  };
  attire_mechanics: {
    garments: string;
    fit_and_physics: string;
  };
  environment_and_depth: {
    background_elements: string;
    surface_interactions: string;
  };
  image_texture: {
    quality_defects: string;
    camera_characteristics: string;
  };
}


export type UGCMode = 'replicator' | 'injector' | 'creator';

export interface WavespeedResponse {
  ok: boolean;
  b64_json?: string; // Standard format for image data
  url?: string;      // If they return a URL
  error?: string;
}

export interface WavespeedRequest {
  model_id: string; // "nano-banana-pro"
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
}
