
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { PromptItem, IdentityContext, TaskType, SafetyMode, AnalysisResult } from "../types";

// Security: Retrieve key from session storage dynamically. Never store in variables.
const getAiClient = () => {
  const key = sessionStorage.getItem("gemini_api_key");
  if (!key) throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey: key });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to extract MIME type and data from Base64 Data URI
const parseDataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image data format");
  return { mimeType: matches[1], data: matches[2] };
};

const LORA_FORGE_DIRECTIVE = `
IDENTITY:
You are "The LoRA Forge," a High-Fidelity Prompt Architect designed to generate training-ready synthetic data for the "Nano Banana Pro" engine.
PROTOCOL STATUS: V3.0 (Vacuum + Realism Injection Active)

PRIMARY OBJECTIVE:
Your goal is to accept visual input (Reference Images) and generate detailed text prompts that effectively "lock" the subject's likeness while strictly controlling realism and body morphology.

CORE LOGIC: THE "FRANKENSTEIN" PROTOCOL
To prevent Identity Drift, you must adhere to the "Silent Face / Loud Body" rule:

1. SILENT FACE: You must NEVER describe facial features (eyes, nose, jaw, hair color) in the text. You must rely 100% on the User's Reference Image (IPAdapter) to provide facial geometry.
2. LOUD BODY: You must ALWAYS describe the body morphology in high-density detail (Body Stack).
3. REALISM INJECTION: You must ALWAYS inject specific "Camera Physics" tags to prevent the "plastic/smooth" look.

PHASE 1: VISIONSTRUCT ANALYSIS
Analyze images and generate an Internal Identity Profile.
CRITICAL CONSTRAINT: 
- facial_description: MUST REMAIN EMPTY/SILENT.
- body_stack: High density anatomical description (Somatotype, Measurements, Tones).
`;

const VACUUM_COMPILER_DIRECTIVE = `
PHASE 2: PROMPT COMPILATION (THE VACUUM COMPILER)
When generating prompts, you must assemble the final text string using this specific Token-Density Order:

[Framing] + [Archetype] + [Action/Pose] + [Environment/Lighting] + [Body_Stack] + [Wardrobe] + [Realism_Stack] + [Tech_Specs]

DETAILED COMPONENT BREAKDOWN:
- Framing: "Hyper-realistic [Shot Type]..."
- Archetype: "young woman, [Broad Aesthetic]..."
- Action/Pose: "[Specific Action]..."
- Environment: "[Setting details]..."
- Body_Stack: [Insert Dense Body Description]
- Wardrobe: [Unique Outfit Description]
- Realism_Stack: [Insert Realism Tags]
- Tech_Specs: "8k, raw photo, sharp focus, highly detailed."

NEGATIVE PROMPT (HARDCODED SAFETY NET):
"airbrushed, plastic skin, doll-like, smooth skin, cgi, 3d render, beauty filter, cartoon, illustration, bad anatomy, distorted hands, extra fingers, asymmetric eyes."

OPERATIONAL RULES:
- No conversational filler.
- No facial adjectives. If you catch yourself writing "hazel eyes" or "small nose," DELETE IT.
- Realism is mandatory.
`;

const RICH_MEDIA_DIRECTIVE = `
# Context & Goal
You are an expert at creating hyper-realistic image generation prompts optimized for AI image generators. Your prompts produce authentic smartphone photos, lifestyle shots, and natural photography.

## JSON Structure Template
Always use this exact structure:
{
  "subject": {
    "description": "[Action-based scene overview]",
    "mirror_rules": "[Rules for mirror selfies]",
    "age": "[Approx age]",
    "expression": "[Emotion]",
    "imperfections": {
       "skin": "[Texture/Pores/Flush]",
       "hair": "[Flyaways/Messy strands]",
       "general": "[Sweat/Creases/Lint]"
    },
    "body": "[Physical Profile - injected]",
    "clothing": { "top": {...}, "bottom": {...} },
    "face": { "makeup": "..." }
  },
  "accessories": { ... },
  "photography": { "camera_style": "...", "angle": "...", "shot_type": "..." },
  "background": { "setting": "...", "elements": [...] }
}

CRITICAL RULES:
1. NO STRUCTURAL FACE DESCRIPTION (Eyes/Nose/Jaw are handled by reference image). Only makeup/expression/imperfections.
2. UNIQUE OUTFITS per item.
3. POPULATE IMPERFECTIONS.
`;

export const analyzeSubjectImages = async (
  headshotDataUrl: string | null,
  bodyshotDataUrl: string | null
): Promise<AnalysisResult> => {
  const ai = getAiClient();
  if (!headshotDataUrl && !bodyshotDataUrl) throw new Error("No images provided");

  const parts = [];
  if (headshotDataUrl) {
    const { mimeType, data } = parseDataUrl(headshotDataUrl);
    parts.push({ inlineData: { mimeType, data } });
  }
  if (bodyshotDataUrl) {
    const { mimeType, data } = parseDataUrl(bodyshotDataUrl);
    parts.push({ inlineData: { mimeType, data } });
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      identity_profile: {
        type: Type.OBJECT,
        properties: {
          uid: { type: Type.STRING, description: "Inferred Name (Culturally appropriate based on visual heritage) or Creative Unique Name" },
          age_estimate: { type: Type.STRING, description: "Estimated age (e.g. '25 years old')" },
          archetype_anchor: { type: Type.STRING, description: "Broad category only (e.g. 'Young woman, commercial model aesthetic')" },
          facial_description: { type: Type.STRING, description: "MUST BE EMPTY STRING (SILENT)" },
          body_stack: { type: Type.STRING, description: "High density anatomical description: Somatotype, Bust, Waist, Hips, Glutes, Limbs." },
          realism_stack: { type: Type.STRING, description: "Camera physics tags: subsurface scattering, skin texture, etc." }
        },
        required: ["uid", "age_estimate", "archetype_anchor", "facial_description", "body_stack", "realism_stack"]
      }
    },
    required: ["identity_profile"]
  };

  parts.push({
    text: `${LORA_FORGE_DIRECTIVE}
    
    TASK: Analyze the provided images and generate the Identity Profile.
    REMEMBER: Facial Description must be SILENT (Empty). Body Stack must be LOUD (Detailed).
    NAME INFERENCE: Assign a fitting name based on the subject's apparent heritage (e.g. 'Yuki' for Japanese, 'Elena' for Eastern European).
    Return JSON.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return parsed as AnalysisResult;

  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const generateDatasetPrompts = async (
  params: {
    taskType: TaskType,
    subjectDescription: string, // Maps to Body Stack
    identity: IdentityContext, // backstory maps to Realism Stack, profession to Archetype
    safetyMode: SafetyMode,
    productImages?: string[],
    count: number,
    startCount: number,
    totalTarget: number,
    previousSettings?: string[]
  }
): Promise<PromptItem[]> => {
  const ai = getAiClient();

  const { taskType, subjectDescription, identity, safetyMode, productImages, count, startCount, totalTarget, previousSettings } = params;

  // --- Manifest Generation ---
  const batchManifest: {
    index: number;
    absoluteIndex: number;
    meta: {
      type: string;
      index: number;
      total: number;
      label: string;
    }
  }[] = [];

  if (taskType === 'product') {
    for (let i = 0; i < count; i++) {
      const absoluteIndex = startCount + i;
      batchManifest.push({
        index: i,
        absoluteIndex,
        meta: { type: "PRODUCT AD", index: absoluteIndex + 1, total: totalTarget, label: "Optimized Ad Composition" }
      });
    }
  } else if (taskType === 'generic') {
    for (let i = 0; i < count; i++) {
      const absoluteIndex = startCount + i;
      batchManifest.push({
        index: i,
        absoluteIndex,
        meta: { type: "UGC LIFESTYLE", index: absoluteIndex + 1, total: totalTarget, label: "Authentic Realism" }
      });
    }
  } else {
    // LoRA Mode - Century Protocol
    const headshotLimit = Math.max(1, Math.floor(totalTarget * 0.35));
    const halfBodyLimit = headshotLimit + Math.max(1, Math.floor(totalTarget * 0.30));
    const threeQuarterLimit = halfBodyLimit + Math.max(1, Math.floor(totalTarget * 0.20));
    const MANDATORY_SEQUENCE = ["Left 1/4 View", "Front View", "Right 1/4 View", "Left Profile", "Right Profile", "Look Up", "Look Down"];

    for (let i = 0; i < count; i++) {
      const absoluteIndex = startCount + i;
      let type = "", label = "", categoryTotal = 0, categoryIndex = 0;

      if (absoluteIndex < headshotLimit) {
        type = "HEADSHOT";
        categoryTotal = headshotLimit;
        categoryIndex = absoluteIndex + 1;
        label = absoluteIndex < MANDATORY_SEQUENCE.length ? MANDATORY_SEQUENCE[absoluteIndex] : "Varied Headshot";
      } else if (absoluteIndex < halfBodyLimit) {
        type = "HALF BODY";
        categoryTotal = halfBodyLimit - headshotLimit;
        categoryIndex = absoluteIndex - headshotLimit + 1;
        label = "Waist Up / Lifestyle";
      } else if (absoluteIndex < threeQuarterLimit) {
        type = "3/4 BODY";
        categoryTotal = threeQuarterLimit - halfBodyLimit;
        categoryIndex = absoluteIndex - halfBodyLimit + 1;
        label = "Knees Up / Environmental";
      } else {
        type = "FULL BODY";
        categoryTotal = totalTarget - threeQuarterLimit;
        categoryIndex = absoluteIndex - threeQuarterLimit + 1;
        label = "Head to Toe";
      }

      batchManifest.push({
        index: i,
        absoluteIndex,
        meta: { type, index: categoryIndex, total: categoryTotal, label }
      });
    }
  }

  const manifestString = batchManifest.map(m =>
    `Item ${m.index + 1}: ${m.meta.type} (${m.meta.label}). Metadata: ${m.meta.index}/${m.meta.total}`
  ).join("\n");

  // Anti-Repetition
  let repetitionDirective = "";
  if (previousSettings && previousSettings.length > 0) {
    // Sanitize: Take last 10, truncate to 50 chars each to prevent context bloat
    const recentSettings = previousSettings.slice(-10).map(s => s.substring(0, 50)).join(", ");
    repetitionDirective = `AVOID SETTINGS: [${recentSettings}]. Invent NEW locations.`;
  }

  // --- HYBRID GENERATION LOGIC ---

  let promptText = "";
  let schema: Schema;

  // MODE A: LORA (Vacuum Protocol)
  if (taskType === 'lora') {
    const BODY_STACK = subjectDescription;
    const REALISM_STACK = identity.backstory || "subsurface scattering, detailed skin texture, visible pores, faint skin sheen";
    const ARCHETYPE = `${identity.age_estimate || "25yo"} ${identity.profession || "woman"}`.trim();

    let clothingDirective = "";
    if (safetyMode === 'nsfw') {
      clothingDirective = `WARDROBE: REVEALING & BOLD. Focus on skin exposure suitable for the setting.
      - PRIORITIZE: Crop Tops, Halters, Low Rise Jeans, Micro Skirts, Bikini Tops, Open Backs, Deep V-Necks.
      - CONTEXTUAL: If gym -> Sports Bra/Shorts. If night -> Mini Dress. If beach -> Bikini.
      - AVOID: "Cutouts" (unless necessary), "Sheer", "Lace".
      - MUST BE UNIQUE PER ITEM.`;
    } else {
      clothingDirective = `WARDROBE: SFW/MODEST. Casual, standard. MUST BE UNIQUE PER ITEM. VARY COLORS, CUTS, AND STYLES.`;
    }

    promptText = `
        ${VACUUM_COMPILER_DIRECTIVE}
        INPUT DATA:
        ARCHETYPE: ${ARCHETYPE}
        BODY_STACK: ${BODY_STACK}
        REALISM_STACK: ${REALISM_STACK}
        ${clothingDirective}
        ${repetitionDirective}
        VARIETY PROTOCOL: ENABLED.
        - NEVER repeat an outfit.
        - NEVER repeat a setting.
        - If you used "Black Top" in Item 1, you CANNOT use it in Item 2.
        - EXPRESSION LOGIC: 10% must be emotional (Laughter, Sadness, Surprise). 90% Neutral/Smile/Alluring.
        - SYNTAX BAN: DO NOT use "(text:0.8)" weighting. Use natural language only.
        - CRITICAL: POPULATE ALL FIELDS. Do not return "none" or "not specified". Invent details if needed.
        
        TASK: Generate exactly ${count} JSON prompts following this MANIFEST:
        ${manifestString}
        OUTPUT TEMPLATE PER ITEM:
        {
          "generation_data": {
            "reference_logic": { "primary_ref": "Headshot", "secondary_ref": "Full Body" },
            "final_prompt_string": "[COMPLIED STRING: Framing + Archetype + Action + Environment + Body + Wardrobe + Realism + Tech]"
          },
          "subject": {
             "description": "...",
             "age": "...",
             "expression": "...",
             "imperfections": { "skin": "...", "hair": "...", "general": "..." },
             "clothing": { "top": { "color": "...", "type": "..." }, "bottom": { "color": "...", "type": "..." } }
          },
          "background": { "setting": "...", "elements": ["..."] },
          "photography": { "shot_type": "...", "angle": "...", "camera_style": "..." }
        }
        Return a JSON array.
      `;

    schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          generation_data: {
            type: Type.OBJECT,
            properties: {
              reference_logic: { type: Type.OBJECT, properties: { primary_ref: { type: Type.STRING }, secondary_ref: { type: Type.STRING } } },
              final_prompt_string: { type: Type.STRING, description: "MANDATORY: The full compiled prompt string." }
            },
            required: ["reference_logic", "final_prompt_string"]
          },
          subject: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              age: { type: Type.STRING },
              expression: { type: Type.STRING },
              imperfections: { type: Type.OBJECT, properties: { skin: { type: Type.STRING }, hair: { type: Type.STRING }, general: { type: Type.STRING } } },
              clothing: {
                type: Type.OBJECT,
                properties: {
                  top: { type: Type.OBJECT, properties: { color: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["color", "type"] },
                  bottom: { type: Type.OBJECT, properties: { color: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["color", "type"] }
                },
                required: ["top", "bottom"]
              }
            },
            required: ["description", "age", "expression", "imperfections", "clothing"]
          },
          background: {
            type: Type.OBJECT,
            properties: {
              setting: { type: Type.STRING },
              elements: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          photography: {
            type: Type.OBJECT,
            properties: {
              shot_type: { type: Type.STRING },
              angle: { type: Type.STRING },
              camera_style: { type: Type.STRING }
            }
          },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["generation_data", "subject", "background", "photography"]
      }
    };

  } else {
    // MODE B: RICH JSON (Product / Generic)

    // Product Logic
    let productDirective = "";
    const parts: any[] = [];
    if (taskType === 'product' && productImages && productImages.length > 0) {
      productImages.forEach(img => {
        const { mimeType, data } = parseDataUrl(img);
        parts.push({ inlineData: { mimeType, data } });
      });
      productDirective = `MODE: PRODUCT AD. Integrate product naturally. Invent branding if generic.`;
    }

    let clothingDirective = "";
    if (safetyMode === 'nsfw') {
      clothingDirective = `WARDROBE: ANATOMICAL. Fit should be "second-skin", "form-fitting".`;
    }

    promptText = `
        ${RICH_MEDIA_DIRECTIVE}
        IDENTITY CONTEXT:
        Name: ${identity.name}
        Profession: ${identity.profession}
        Backstory: ${identity.backstory}
        
        SUBJECT: SPECIFIC. Use this PHYSICAL PROFILE: "${subjectDescription}"
        ${clothingDirective}
        VARIETY PROTOCOL: ENABLED.
        - NEVER repeat an outfit.
        - NEVER repeat a setting.
        
        ${productDirective}
        ${repetitionDirective}
        
        TASK: Generate exactly ${count} JSON prompts following this MANIFEST:
        ${manifestString}
        
        Return a JSON array.
      `;

    schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The full JSON prompt object stringified." },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["text", "tags"]
      }
    };
  }

  const parts: any[] = [];
  // Add product images again if needed for Rich mode
  if (taskType === 'product' && productImages && productImages.length > 0) {
    productImages.forEach(img => {
      const { mimeType, data } = parseDataUrl(img);
      parts.push({ inlineData: { mimeType, data } });
    });
  }
  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1,
      }
    });

    const rawData = JSON.parse(response.text || "[]");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawData.map((item: any, idx: number) => {
      const manifestItem = batchManifest[idx];
      // For Rich JSON, 'text' is already stringified. For LoRA, we stringify the whole item.
      const textContent = taskType === 'lora' ? JSON.stringify(item) : item.text;

      return {
        id: generateId(),
        text: textContent,
        tags: item.tags || [],
        generationMeta: manifestItem ? manifestItem.meta : undefined
      };
    });

  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

export const refineSinglePrompt = async (originalPrompt: string, instruction: string): Promise<string> => {
  return originalPrompt;
}
