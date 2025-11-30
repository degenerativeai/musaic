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

IMPORTANT EXCLUSION:
Do NOT describe moles or birthmarks. They are too specific and difficult to reproduce consistently. Normal skin imperfections like pores, freckles, or slight texture are acceptable and encouraged.

ANALYSIS PROTOCOL
Before generating the final JSON, perform a silent "Visual Sweep" (internal processing only):

Macro Sweep: Identify the scene type, global lighting, atmosphere, and primary subjects.
Biometric & Demographic Sweep: For human subjects, strictly analyze specific skin tone phenotypes (including undertones), racial/ethnic visual markers, physical build (somatotype), and relative physical measurements/proportions. CRITICALLY: For female subjects, explicitly analyze bust size, shape, and proportion relative to the body. For male subjects, analyze chest dimensions and musculature.
Micro Sweep: Scan for textures, imperfections (excluding moles), background clutter, reflections, shadow gradients, and text (OCR).
Relationship Sweep: Map the spatial and semantic connections between objects.

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
          physical_profile: { type: Type.STRING, description: "The detailed VisionStruct analysis text of physical attributes." },
          identity_inference: {
              type: Type.OBJECT,
              properties: {
                  name: { type: Type.STRING, description: "A region-appropriate full name based on heritage/phenotype." },
                  profession: { type: Type.STRING, description: "A plausible profession based on vibe/clothing." },
                  backstory: { type: Type.STRING, description: "A brief 1-2 sentence lifestyle backstory." }
              },
              required: ["name", "profession", "backstory"]
          }
      },
      required: ["physical_profile", "identity_inference"]
  };

  parts.push({
    text: `${VISION_STRUCT_DIRECTIVE}
    
    TASK: Analyze the provided image(s). 
    1. Synthesize a single coherent PHYSICAL PROFILE. Focus on biometrics and visual attributes: Skin tone, Body Shape (Morphology/Measurements), Facial Features, Hair (Color/Texture).
    CRITICAL: Do NOT describe the clothing currently worn in the image (e.g., do NOT say "wearing a red dress"). The profile must be clothing-agnostic so the subject can be dressed in new outfits.
    Exclude moles/birthmarks.
    2. Based on the visual phenotype and heritage markers, INFER a plausible IDENTITY (Name, Profession, Backstory).
       - If they look Mexican, choose a name like 'Marina Gonzalez'.
       - If they look like a travel model, set profession to 'Travel Blogger' and backstory to match.
       - If they look urban, set to 'Marketing Exec' in the city, etc.
    
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
      totalTarget: number
  }
): Promise<PromptItem[]> => {
  const ai = getAiClient();

  const { taskType, subjectDescription, identity, safetyMode, productImages, count, startCount, totalTarget } = params;

  // --- 1. Manifest Generation (Pre-calculation) ---
  const batchManifest = [];

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

  } else {
      // LORA / GENERIC MODE: Strict Framing Ratios
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
      subjectDirective = `SUBJECT: GENERIC. Create a generic description (e.g., "A young woman"). Do NOT use the specific physical profile.`;
  } else {
      subjectDirective = `SUBJECT: SPECIFIC. Use this PHYSICAL PROFILE: "${subjectDescription}"`;
  }

  let clothingDirective = "";
  if (safetyMode === 'nsfw' && taskType !== 'generic') {
      clothingDirective = `SAFETY: NSFW (Accentuate Form). 
      Clothing should be form-fitting and accentuate the figure (tight dresses, yoga pants, crop tops).
      CRITICAL CONTEXT RULE: Swimwear/Bikinis are ONLY allowed in beach/pool/water contexts. Lingerie is ONLY allowed in bedroom/private contexts. 
      For public/street/gym settings, use appropriate tight/form-fitting streetwear or activewear. DO NOT put subject in a bikini in the snow or a library.`;
  } else {
      clothingDirective = `SAFETY: SFW (Modest). Casual, standard, non-revealing clothing appropriate for the setting.`;
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

  // Logic to determine correct strict rules for the footer of the prompt
  let framingRules = "";
  if (taskType === 'product') {
      framingRules = `3. PRODUCT FOCUS: Ensure the product is the focal point or naturally integrated. Highlight specific product details mentioned in the Product Directive.
      4. VARIETY: Do NOT follow a fixed headshot/body shot ratio. Use your knowledge to create OPTIMAL ad placement shots.`;
  } else {
      framingRules = `3. For HEADSHOTS: Focus on face/hair/top. 
      4. For BODY SHOTS: Inject full physical profile details.`;
  }

  const promptText = `
    ${REALISTIC_IMAGE_GENERATOR_DIRECTIVE}

    IDENTITY CONTEXT:
    Name: ${identity.name}
    Profession: ${identity.profession}
    Backstory: ${identity.backstory}

    ${subjectDirective}
    IMPORTANT: The Physical Profile may describe the subject's body, but you MUST IGNORE any clothing mentioned in it.
    ${clothingDirective}
    ${productDirective}

    TASK: Generate exactly ${count} JSON prompts following this SPECIFIC MANIFEST:
    
    ${manifestString}

    CRITICAL RULES:
    1. STRICTLY follow the "Item" order. Item 1 in your output MUST match Item 1 in the manifest.
    2. UNIQUE OUTFITS: Every single prompt must have a UNIQUE outfit. Do not repeat the outfit from the reference image. Invent new clothes that match the 'setting' and 'weather'.
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