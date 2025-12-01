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
1. MOLES/BIRTHMARKS: Do NOT describe moles or birthmarks (too specific/hard to reproduce).
2. STRUCTURAL FACIAL GEOMETRY: Do NOT describe the shape of eyes, nose, lips, or jawline. These features are handled by a separate reference image. Describing them creates conflicts.
   - Example (BAD): "Large almond-shaped brown eyes, straight nose."
   - Example (GOOD): "Warm olive skin tone with slight texture on cheeks."

ANALYSIS PROTOCOL
Before generating the final JSON, perform a silent "Visual Sweep" (internal processing only):

Macro Sweep: Identify the scene type, global lighting, atmosphere, and primary subjects.

Biometric & Demographic Sweep: 
1. AGE ESTIMATION: Strictly estimate the subject's visual age (e.g., "19", "24", "45").
2. PHENOTYPE: Strictly analyze specific skin tone phenotypes (including undertones) and skin texture (pores, sheen).
3. BODY METRICS (MAXIMAL DETAIL): You MUST provide a granular anatomical analysis of the body:
   - Height: Estimate relative height (e.g. "Petite", "Statuesque", "Approx 5'7").
   - Somatotype: Ectomorph/Mesomorph/Endomorph.
   - Bust: Detailed analysis of size, shape, fullness, and proportion relative to frame.
   - Waist: Definition, circumference relative to hips, stomach tone (flat, soft, abs).
   - Hips & Glutes: Width, shape (curvy, narrow), and projection.
   - Limbs: Tone, musculature, and length.

Micro Sweep: Scan for textures, imperfections (flyaways, skin texture, fabric pull), background clutter.

OUTPUT FORMAT (STRICT)
You must return ONLY a single valid JSON object.
`;

const REALISTIC_IMAGE_GENERATOR_DIRECTIVE = `
# Context & Goal
You are an expert at creating hyper-realistic image generation prompts optimized for AI image generators. Your prompts produce authentic smartphone photos, lifestyle shots, and natural photography, not staged or artificial-looking images.

## Core Philosophy
**Activity-driven authenticity.** Create prompts that describe complete scenes with natural actions, contextual consistency, and realistic imperfections.

## THE CENTURY PROTOCOL Rules
1. Uniqueness: No repeated scenarios or identical outfits.
2. Forbidden Words: Sheer, Lace, Nude, Tube tops.
3. Authenticity: Include "authentic imperfections" (sweat, flyaways, creases).
4. Camera: Use simple camera language (smartphone front camera, etc).

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
    "hair": { "color": "...", "style": "..." },
    "body": "[Physical Profile - injected]",
    "clothing": { "top": {...}, "bottom": {...} },
    "face": { "makeup": "..." }
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
          physical_profile: { type: Type.STRING, description: "The detailed VisionStruct analysis text focusing strictly on Body Metrics and Skin Texture (No facial geometry)." },
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
       - SECONDARY FOCUS: Skin Tone, Texture, and Realistic Imperfections (pores, flyaways).
       - STRICT EXCLUSION: Do NOT describe structural facial geometry (eyes, nose, mouth shape) as this conflicts with reference images.
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
  // Explicitly type the manifest array to avoid implicit 'any' errors in strict mode
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
        const currentNumber = absoluteIndex + 1; // 1-based number for display
        
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
      subjectDirective = `SUBJECT: SPECIFIC. Use this PHYSICAL PROFILE: "${subjectDescription}"`;
  }

  // ANATOMICAL WARDROBE DIRECTIVE (Revised "NSFW" Logic)
  let clothingDirective = "";
  if (safetyMode === 'nsfw' && taskType !== 'generic') {
      clothingDirective = `WARDROBE DIRECTIVE: ANATOMICAL / FIGURE-FORMING.
      The goal is to accurately map the subject's somatotype for LoRA training using high-fidelity clothing descriptions.
      
      KEYWORDS TO USE:
      - "Second-skin fit", "Anatomical seaming", "Compressive activewear", "Sculpted bodice", "Bias-cut", "Articulated fit", "Micro-ribbed", "Body-contouring", "Sheath silhouette".
      
      INSTRUCTIONS:
      1. Clothing must trace the body's topography exactly. Avoid loose, baggy, or obscuring drapes.
      2. For Activewear: Use specific terms like "racerback sports bra", "high-compression leggings", "biker shorts".
      3. For Casual: Use "fitted baby tee", "bodycon midi", "skinny jeans", "corset top".
      4. Avoid generic terms like "sexy" or "revealing". Use technical fashion terms that describe the TIGHTNESS and FIT.`;
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
      TASK MODE: UGC PRODUCT ADVERTISEMENT
      1. INTEGRATION: These are PRODUCT SHOTS. Integrate the product naturally into the scene.
         - If multiple images are provided (e.g., bar + packaging), use them creatively (e.g., subject eating the bar, packaging sitting on table in foreground).
      2. UGC STYLE: The photos should look like "User Generated Content" ads for social media. High quality but authentic, influential, and engaging.
      3. CREATIVE BRANDING (CRITICAL):
         - Analyze the product images. If they look generic, unbranded, or lack clear packaging, you MUST INVENT a creative brand name, a slogan, and describe the packaging design in the prompt.
         - Treat it as a "Situational Mockup" for a client.
         - Example: "Holding a 'FrostBite' ice cream bar, wrapper with blue snowflakes visible on the cafe table."
      4. COMPOSITION STRATEGY:
         - IGNORE standard portrait ratios (Headshot/Half Body/etc).
         - OPTIMIZE for product visibility and ad appeal.
         - VARY the shot types: Detail shots, POV shots, Lifestyle integration, Environmental shots.
      `;
  }

  // Framing Rules
  let framingRules = "";
  if (taskType === 'product') {
      framingRules = `3. PRODUCT FOCUS: Ensure the product is the focal point or naturally integrated. Highlight specific product details mentioned in the Product Directive.
      4. VARIETY: Do NOT follow a fixed headshot/body shot ratio. Use your knowledge to create OPTIMAL ad placement shots.`;
  } else if (taskType === 'generic') {
      framingRules = `3. REALISM FOCUS: Prioritize authentic lighting, natural poses, and "Instagram-style" composition. 
      4. VARIETY: Do NOT use strict Headshot/BodyShot buckets. Generate a diverse mix of shot types (Close-up, Full Body, Selfie, Candid) suitable for a high-quality realistic dataset.`;
  } else {
      // LoRA Mode
      framingRules = `3. For HEADSHOTS: Focus on face/hair/top. 
      4. For BODY SHOTS: Inject full physical profile details.`;
  }

  // Anti-Repetition Logic
  let repetitionDirective = "";
  if (previousSettings && previousSettings.length > 0) {
      // Pass last 25 settings to maintain context window health while preventing repetition
      const recentSettings = previousSettings.slice(-25).join(", ");
      repetitionDirective = `AVOID REPETITION: The following settings/scenarios have ALREADY been generated and must NOT be used again: [${recentSettings}]. Invent completely NEW locations and activities.`;
  }

  const promptText = `
    ${REALISTIC_IMAGE_GENERATOR_DIRECTIVE}

    IDENTITY CONTEXT:
    Name: ${identity.name}
    Age: ${identity.age_estimate}
    Profession: ${identity.profession}
    Backstory: ${identity.backstory}

    ${subjectDirective}
    IMPORTANT: The Physical Profile may describe the subject's body, but you MUST IGNORE any clothing mentioned in it.
    ${clothingDirective}
    ${productDirective}
    ${repetitionDirective}

    TASK: Generate exactly ${count} JSON prompts following this SPECIFIC MANIFEST:
    
    ${manifestString}

    CRITICAL RULES:
    1. STRICTLY follow the "Item" order. Item 1 in your output MUST match Item 1 in the manifest.
    2. UNIQUE OUTFITS: Every single prompt must have a UNIQUE outfit. Do not repeat the outfit from the reference image. Invent new clothes that match the 'setting' and 'weather'.
    3. IMPERFECTIONS: You MUST populate the 'imperfections' object for every prompt.
    4. COMPLETENESS CHECK: Ensure every single JSON object in the array is fully formed with all fields (Subject, Clothing, Background, Photography). Do not truncate the last items.
    ${framingRules}
    
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