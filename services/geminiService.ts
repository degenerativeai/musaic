
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
                uid: { type: Type.STRING, description: "Subject Name" },
                archetype_anchor: { type: Type.STRING, description: "Broad category only (e.g. 'Young woman, commercial model aesthetic')" },
                facial_description: { type: Type.STRING, description: "MUST BE EMPTY STRING (SILENT)" },
                body_stack: { type: Type.STRING, description: "High density anatomical description: Somatotype, Bust, Waist, Hips, Glutes, Limbs." },
                realism_stack: { type: Type.STRING, description: "Camera physics tags: subsurface scattering, skin texture, etc." }
            },
            required: ["uid", "archetype_anchor", "facial_description", "body_stack", "realism_stack"]
        }
      },
      required: ["identity_profile"]
  };

  parts.push({
    text: `${LORA_FORGE_DIRECTIVE}
    
    TASK: Analyze the provided images and generate the Identity Profile.
    REMEMBER: Facial Description must be SILENT (Empty). Body Stack must be LOUD (Detailed).
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
      subjectDescription: string, // This maps to Body Stack
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
  
  // Mapping Inputs to Vacuum Protocol Variables
  const BODY_STACK = subjectDescription;
  const REALISM_STACK = identity.backstory || "subsurface scattering, detailed skin texture, visible pores, faint skin sheen, peach fuzz, natural lip texture, unretouched, natural film grain";
  const ARCHETYPE = identity.profession || "young woman";
  
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
      // LoRA Mode - Century Protocol Ratios
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

  // Wardrobe Directives
  let clothingDirective = "";
  if (safetyMode === 'nsfw' && taskType !== 'generic') {
      clothingDirective = `WARDROBE: ANATOMICAL/FIGURE-FORMING. Use technical terms: "second-skin fit", "anatomical seaming", "compressive", "sculpted", "bias-cut". Clothing must trace the body.`;
  } else {
      clothingDirective = `WARDROBE: SFW/MODEST. Casual, standard, non-revealing.`;
  }

  // Product Directive
  let productDirective = "";
  const parts: any[] = [];
  if (taskType === 'product' && productImages && productImages.length > 0) {
      productImages.forEach(img => {
          const { mimeType, data } = parseDataUrl(img);
          parts.push({ inlineData: { mimeType, data } });
      });
      productDirective = `MODE: PRODUCT AD. Integrate product naturally. Invent branding if generic.`;
  }

  // Anti-Repetition
  let repetitionDirective = "";
  if (previousSettings && previousSettings.length > 0) {
      const recentSettings = previousSettings.slice(-25).join(", ");
      repetitionDirective = `AVOID SETTINGS: [${recentSettings}]. Invent NEW locations.`;
  }

  const promptText = `
    ${VACUUM_COMPILER_DIRECTIVE}

    INPUT DATA:
    ARCHETYPE: ${ARCHETYPE}
    BODY_STACK: ${BODY_STACK}
    REALISM_STACK: ${REALISM_STACK}

    ${clothingDirective}
    ${productDirective}
    ${repetitionDirective}

    TASK: Generate exactly ${count} JSON prompts following this MANIFEST:
    ${manifestString}

    OUTPUT TEMPLATE PER ITEM:
    {
      "generation_data": {
        "reference_logic": {
          "primary_ref": "Headshot (0.8)",
          "secondary_ref": "Full Body (0.8)"
        },
        "final_prompt_string": "[THE ASSEMBLED STRING]"
      }
    }

    CRITICAL RULES:
    1. NO FACIAL FEATURES in the prompt string.
    2. USE DENSE TOKEN format.
    3. UNIQUE OUTFITS per item.
    
    Return a JSON array of these objects.
  `;

  parts.push({ text: promptText });

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        generation_data: {
            type: Type.OBJECT,
            properties: {
                reference_logic: {
                    type: Type.OBJECT,
                    properties: {
                        primary_ref: { type: Type.STRING },
                        secondary_ref: { type: Type.STRING }
                    }
                },
                final_prompt_string: { type: Type.STRING }
            }
        },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["generation_data"]
    }
  };

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
        // Ensure text is the full stringified object for the Card to parse
        const textContent = JSON.stringify(item);
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
    return originalPrompt; // Disabled for Vacuum Protocol to prevent breaking the token string
}
