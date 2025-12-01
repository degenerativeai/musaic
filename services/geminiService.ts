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

const VISION_STRUCT_DIRECTIVE = `
ROLE & OBJECTIVE
You are VisionStruct, an advanced Computer Vision & Data Serialization Engine. Your sole purpose is to ingest visual input (images) and transcode discernible visual elements—both macro and micro—into a rigorous, machine-readable JSON format.

CORE DIRECTIVE
Do not summarize. Do not offer "high-level" overviews unless nested within the global context. You must capture maximal visual data available in the image. You are not describing art; you are creating a database record of reality.

IMPORTANT EXCLUSIONS (CRITICAL):
1. MOLES/BIRTHMARKS: Do NOT describe moles or birthmarks.
2. FACE & HAIR IDENTITY: Do NOT describe the shape of eyes, nose, lips, jawline, hair color, or hair style. These features are handled by an external reference image (IPAdapter). Describing them creates conflicts.
   - Example (BAD): "Long wavy brown hair, almond eyes."
   - Example (GOOD): "Clear skin with slight texture."

ANALYSIS PROTOCOL
Before generating the final JSON, perform a silent "Visual Sweep" (internal processing only):

Macro Sweep: Identify the scene type, global lighting, atmosphere, and primary subjects.

Biometric & Demographic Sweep: 
1. AGE ESTIMATION: Strictly estimate the subject's visual age (e.g., "19", "24", "45").
2. PHENOTYPE: Analyze skin tone phenotypes (including undertones) and skin texture (pores, sheen).
3. BODY METRICS (MAXIMAL DETAIL - PRIORITY 1): You MUST provide a granular anatomical analysis of the body. You must explicitly measure and describe:
   - Height: Estimate relative height (e.g. "Petite 5'2", "Statuesque 5'9").
   - Somatotype: Ectomorph/Mesomorph/Endomorph.
   - Bust: Detailed analysis of size (e.g., "Small", "Medium", "Full"), shape, projection, and proportion relative to frame.
   - Waist: Definition, circumference relative to hips, stomach tone (flat, soft, abs).
   - Hips & Glutes: Width, shape (curvy, narrow, heart-shaped), and projection.
   - Limbs: Tone, musculature, and length.

Micro Sweep: Scan for textures, imperfections (flyaways, skin texture, fabric pull), background clutter.

OUTPUT FORMAT (STRICT)
You must return ONLY a single valid JSON object.
`;

const REALISTIC_IMAGE_GENERATOR_DIRECTIVE = `
# Context & Goal
You are an expert at creating hyper-realistic image generation prompts optimized for AI image generators using IPAdapter/LoRA. The goal is to describe the SCENE and BODY, but leave the FACE and HAIR identity to the reference image.

## Core Philosophy
**Activity-driven authenticity.** Create prompts that describe complete scenes with natural actions, contextual consistency, and realistic imperfections.

## THE CENTURY PROTOCOL Rules
1. Uniqueness: No repeated scenarios or identical outfits.
2. Forbidden Words: Sheer, Lace, Nude, Tube tops.
3. Authenticity: Include "authentic imperfections" (sweat, fabric creases).
4. Camera: Use simple camera language (smartphone front camera, etc).

## JSON Structure Template
Always use this exact structure:
{
  "subject": {
    "description": "[Action-based scene overview - NO face/hair descriptions]",
    "mirror_rules": "[Rules for mirror selfies]",
    "age": "[Approx age]",
    "expression": "[Emotion]",
    "imperfections": {
       "skin": "[Texture/Pores/Flush]",
       "general": "[Sweat/Creases/Lint]"
    },
    "body": "[Physical Profile - injected]",
    "clothing": { "top": {...}, "bottom": {...} }
  },
  "accessories": { ... },
  "photography": { "camera_style": "...", "angle": "...", "shot_type": "..." },
  "background": { "setting": "...", "elements": [...] }
}
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
          physical_profile: { type: Type.STRING, description: "The detailed VisionStruct analysis text focusing strictly on Body Metrics (Bust, Waist, Hips, Glutes, Height) and Skin Texture. NO face/hair details." },
          identity_inference: {
              type: Type.OBJECT,
              properties: {
                  name: { type: Type.STRING, description: "A region-appropriate full name based on heritage/phenotype." },
                  age_estimate: { type: Type.STRING, description: "The estimated visual age (e.g. '19', '24', 'Late 40s')." },
                  profession: { type: Type.STRING, description: "A plausible profession based on vibe/clothing." },
                  backstory: { type: Type.STRING, description: "A brief 1-2 sentence lifestyle backstory." }
              },
              required: ["name", "age_estimate", "profession", "backstory"]
          }
      },
      required: ["physical_profile", "identity_inference"]
  };

  parts.push({
    text: `${VISION_STRUCT_DIRECTIVE}
    
    TASK: Analyze the provided image(s). 
    1. Synthesize a single coherent PHYSICAL PROFILE. 
       - PRIMARY FOCUS: Granular Body Metrics (Height, Bust, Waist, Hips, Glutes, Stomach, Musculature).
       - SECONDARY FOCUS: Skin Tone, Texture.
       - STRICT EXCLUSION: Do NOT describe structural facial geometry (eyes, nose, mouth shape) or Hair (Color/Style).
       - CLOTHING: Do NOT describe the clothing currently worn.
    
    2. Based on the visual phenotype and heritage markers, INFER a plausible IDENTITY (Name, Age, Profession, Backstory).
    
    Return the result as JSON.`
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
      subjectDescription: string,
      identity: IdentityContext,
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

  // --- 1. Manifest Generation (Pre-calculation) ---
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
      // PRODUCT MODE: Ignore framing ratios. Optimize for ad placement variety.
      for (let i = 0; i < count; i++) {
        const absoluteIndex = startCount + i;
        batchManifest.push({
            index: i,
            absoluteIndex,
            meta: {
                type: "PRODUCT AD",
                index: absoluteIndex + 1,
                total: totalTarget,
                label: "Optimized Ad Composition"
            }
        });
      }

  } else if (taskType === 'generic') {
      // GENERIC MODE: No strict buckets. Focus on UGC Realism and Variety.
      for (let i = 0; i < count; i++) {
        const absoluteIndex = startCount + i;
        batchManifest.push({
            index: i,
            absoluteIndex,
            meta: {
                type: "UGC LIFESTYLE",
                index: absoluteIndex + 1,
                total: totalTarget,
                label: "Authentic Realism / Instagram Aesthetic"
            }
        });
      }

  } else {
      // LORA MODE: Strict Framing Ratios (The Century Protocol)
      const headshotLimit = Math.max(1, Math.floor(totalTarget * 0.35)); 
      const halfBodyLimit = headshotLimit + Math.max(1, Math.floor(totalTarget * 0.30));
      const threeQuarterLimit = halfBodyLimit + Math.max(1, Math.floor(totalTarget * 0.20));
      
      const MANDATORY_SEQUENCE = [
        "Left 1/4 View", "Front View", "Right 1/4 View", 
        "Left Profile", "Right Profile", "Look Up", "Look Down"
      ];

      for (let i = 0; i < count; i++) {
        const absoluteIndex = startCount + i; // 0-based index
        
        let type = "";
        let label = "";
        let categoryTotal = 0;
        let categoryIndex = 0; // 1-based index within category

        if (absoluteIndex < headshotLimit) {
            type = "HEADSHOT";
            categoryTotal = headshotLimit;
            categoryIndex = absoluteIndex + 1;
            
            // Determine specific label
            if (absoluteIndex < MANDATORY_SEQUENCE.length) {
                label = MANDATORY_SEQUENCE[absoluteIndex];
            } else {
                label = "Varied Headshot Expression";
            }

        } else if (absoluteIndex < halfBodyLimit) {
            type = "HALF BODY";
            categoryTotal = halfBodyLimit - headshotLimit;
            categoryIndex = absoluteIndex - headshotLimit + 1;
            label = "Waist Up / Lifestyle Action";

        } else if (absoluteIndex < threeQuarterLimit) {
            type = "3/4 BODY";
            categoryTotal = threeQuarterLimit - halfBodyLimit;
            categoryIndex = absoluteIndex - halfBodyLimit + 1;
            label = "Knees Up / Environmental";

        } else {
            type = "FULL BODY";
            categoryTotal = totalTarget - threeQuarterLimit;
            categoryIndex = absoluteIndex - threeQuarterLimit + 1;
            label = "Head to Toe / Full Outfit";
        }

        batchManifest.push({
            index: i, // Index within this batch response
            absoluteIndex,
            meta: {
                type,
                index: categoryIndex,
                total: categoryTotal,
                label
            }
        });
      }
  }

  // --- 2. Construct Prompt ---

  const manifestString = batchManifest.map(m => 
    `Item ${m.index + 1}: ${m.meta.type} (${m.meta.label}). Metadata: ${m.meta.index}/${m.meta.total}`
  ).join("\n");

  let subjectDirective = "";
  if (taskType === 'generic') {
      subjectDirective = `SUBJECT: GENERIC. Create a generic description (e.g., "A young woman", "A fitness influencer"). Do NOT use the specific physical profile. Focus on VIBE and AESTHETIC.`;
  } else {
      subjectDirective = `SUBJECT: SPECIFIC. Use this PHYSICAL PROFILE for the BODY: "${subjectDescription}"`;
  }

  // ANATOMICAL WARDROBE DIRECTIVE
  let clothingDirective = "";
  if (safetyMode === 'nsfw' && taskType !== 'generic') {
      clothingDirective = `WARDROBE DIRECTIVE: ANATOMICAL / FIGURE-FORMING.
      The goal is to accurately map the subject's somatotype for LoRA training using high-fidelity clothing descriptions.
      KEYWORDS: "Second-skin fit", "Anatomical seaming", "Compressive", "Sculpted", "Body-contouring".
      INSTRUCTIONS: Clothing must trace the body's topography exactly.`;
  } else {
      clothingDirective = `WARDROBE DIRECTIVE: SFW (Modest/Standard). Casual, standard, non-revealing clothing appropriate for the setting.`;
  }

  let productDirective = "";
  const parts: any[] = [];
  
  if (taskType === 'product' && productImages && productImages.length > 0) {
      productImages.forEach(img => {
          const { mimeType, data } = parseDataUrl(img);
          parts.push({ inlineData: { mimeType, data } });
      });
      productDirective = `
      TASK MODE: UGC PRODUCT ADVERTISEMENT.
      Integration: Integrate product naturally.
      Branding: Invent creative brand if generic.
      Composition: Optimize for product visibility.
      `;
  }

  // Anti-Repetition Logic
  let repetitionDirective = "";
  if (previousSettings && previousSettings.length > 0) {
      const recentSettings = previousSettings.slice(-25).join(", ");
      repetitionDirective = `AVOID REPETITION: The following settings have ALREADY been used: [${recentSettings}]. Invent NEW locations.`;
  }

  const promptText = `
    ${REALISTIC_IMAGE_GENERATOR_DIRECTIVE}

    IDENTITY CONTEXT:
    Name: ${identity.name}
    Age: ${identity.age_estimate}
    Profession: ${identity.profession}
    Backstory: ${identity.backstory}

    ${subjectDirective}
    IMPORTANT: The Physical Profile describes the BODY. Do NOT describe the Face/Hair. Do NOT describe clothing from the reference.
    ${clothingDirective}
    ${productDirective}
    ${repetitionDirective}

    TASK: Generate exactly ${count} JSON prompts following this SPECIFIC MANIFEST:
    
    ${manifestString}

    CRITICAL RULES:
    1. STRICTLY follow the "Item" order.
    2. UNIQUE OUTFITS: Every single prompt must have a UNIQUE outfit.
    3. FACE/HAIR EXCLUSION: Do NOT output 'hair' or 'face' objects in the JSON. Only 'imperfections' for the face.
    4. BODY DETAIL: The 'body' field MUST contain the FULL verbose physical profile provided above. Do not summarize it.
    5. COMPLETENESS CHECK: Ensure every single JSON object is fully formed.
    
    Return a JSON array of objects with 'text' (stringified JSON) and 'tags'.
  `;

  parts.push({ text: promptText });

  const schema: Schema = {
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
    
    // Merge the AI result with our pre-calculated manifest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawData.map((item: any, idx: number) => {
        const manifestItem = batchManifest[idx];
        return {
            ...item,
            id: generateId(),
            generationMeta: manifestItem ? manifestItem.meta : undefined
        };
    });

  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

export const refineSinglePrompt = async (originalPrompt: string, instruction: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Original JSON Prompt: ${originalPrompt}\nInstruction: ${instruction}\nReturn the updated valid JSON string only.`,
        });
        return response.text?.trim() || originalPrompt;
    } catch (e) {
        return originalPrompt;
    }
}