
export type ImageAspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageProvider = 'wavespeed' | 'google';

export interface ImageGenerationOptions {
    provider: ImageProvider;
    apiKey: string; // Wavespeed Key OR Google Key
    prompt: string;
    aspectRatio: ImageAspect;
    referenceImages?: string[]; // Optional array of base64 strings
    resolution?: '2k' | '4k';
}

export interface ImageGenerationResult {
    ok: boolean;
    b64_json?: string;
    url?: string;
    error?: string;
}

const ASPECT_RATIOS: { [key in ImageAspect]: { width: number, height: number } } = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:3': { width: 1152, height: 864 },
    '3:4': { width: 864, height: 1152 }
};

// --- IPC Bridge Type helper ---
// --- IPC Bridge Type helper ---
// @ts-ignore
const safeApiRequest = async (url: string, options: any) => {
    const TIMEOUT_MS = 90000; // 90 seconds timeout

    const requestPromise = fetch(url, options);

    // Race against timeout
    try {
        const result = await Promise.race([
            requestPromise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), TIMEOUT_MS))
        ]);
        return result;
    } catch (e: any) {
        console.error("API Request Failed or Timed Out", e);
        return {
            ok: false,
            status: 408, // Request Timeout
            text: async () => e.message,
            json: async () => ({ error: e.message })
        };
    }
};

// --- Wavespeed Implementation ---
const generateWavespeed = async (options: ImageGenerationOptions): Promise<ImageGenerationResult> => {
    try {
        console.log("Sending request to Wavespeed...");

        // Determine Mode: Standard Text-to-Image OR Edit (Reference Image)
        const hasRefs = options.referenceImages && options.referenceImages.length > 0;

        // Endpoint Selection
        // Base: https://api.wavespeed.ai/api/v3/google/gemini-3-pro-image
        // Edit: /edit
        // Standard: /text-to-image
        const baseUrl = "https://api.wavespeed.ai/api/v3/google/gemini-3-pro-image";
        const url = hasRefs ? `${baseUrl}/edit` : `${baseUrl}/text-to-image`;

        console.log(`Wavespeed Mode: ${hasRefs ? 'EDIT' : 'STANDARD'} (${url})`);

        // Payload Construction
        const payload: any = {
            prompt: options.prompt + (options.resolution === '4k' ? ", extremely detailed 4k resolution" : ""),
            aspect_ratio: options.aspectRatio,
            enable_sync_mode: true,
            enable_base64_output: true,
            output_format: "png"
        };

        if (hasRefs) {
            // Nano Banana Pro Edit expects "images" (not image_urls) with full Data URIs
            payload.images = options.referenceImages?.map(img => img.startsWith('data:') ? img : `data:image/png;base64,${img}`) || [];
        }

        const response = await safeApiRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Wavespeed API Error:", response.status, err);
            return { ok: false, error: `Wavespeed (${response.status}): ${err}` };
        }

        const data = await response.json();
        console.log("Wavespeed success:", data);

        let resultData = data;
        if (data.data) {
            resultData = data.data;
        }

        // --- Response Parsing (Standardized) ---

        // 1. Direct String (URL or Base64)
        if (typeof resultData === 'string') {
            if (resultData.startsWith('http')) return { ok: true, url: resultData };
            const base64Match = resultData.match(/base64,(.+)$/);
            if (base64Match && base64Match[1]) return { ok: true, b64_json: base64Match[1] };
            if (resultData.length > 100 && !resultData.includes(' ')) return { ok: true, b64_json: resultData };
        }

        // 2. Object with keys
        if (resultData.image_url) return { ok: true, url: resultData.image_url };
        if (resultData.url) return { ok: true, url: resultData.url };
        if (resultData.base64) return { ok: true, b64_json: resultData.base64 };

        // 3. Nested "output"
        if (resultData.output) {
            if (resultData.output.image_url) return { ok: true, url: resultData.output.image_url };
            if (resultData.output.url) return { ok: true, url: resultData.output.url };
            if (resultData.output.base64) return { ok: true, b64_json: resultData.output.base64 };
        }

        // 4. Array format (Generic)
        if (Array.isArray(resultData) && resultData[0]) {
            if (resultData[0].b64_json) return { ok: true, b64_json: resultData[0].b64_json };
            if (resultData[0].url) return { ok: true, url: resultData[0].url };
        }

        // 5. "outputs" Array (Wavespeed V3 specific)
        if (resultData.outputs && Array.isArray(resultData.outputs) && resultData.outputs[0]) {
            const output = resultData.outputs[0];
            if (typeof output === 'string') {
                const base64Match = output.match(/base64,(.+)$/);
                if (base64Match && base64Match[1]) return { ok: true, b64_json: base64Match[1] };
                if (output.startsWith('http')) return { ok: true, url: output };
            }
        }

        // Fallback
        const contentSnippet = JSON.stringify(resultData).substring(0, 300);
        console.error("Unknown response format:", data);
        return { ok: false, error: `Unknown response format. Content: ${contentSnippet}` };

    } catch (e: any) {
        console.error("Wavespeed Exception:", e);
        return { ok: false, error: e.message };
    }
};

// --- Google Implementation ---
const generateGoogle = async (options: ImageGenerationOptions): Promise<ImageGenerationResult> => {
    try {
        console.log("Sending request to Google (Nano Banana Pro / Gemini 3)...");

        // Use standard Gemini generateContent endpoint for multimodal models
        // Ref: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${options.apiKey}`;

        // Enhanced Prompt Engineering for Resolution refinement (optional but helpful)
        let finalPrompt = options.prompt;
        if (options.resolution === '4k') {
            finalPrompt = `4K Ultra HD, Highly Detailed, ${options.prompt}`;
        }

        const parts: any[] = [{ text: finalPrompt }];

        // Logic to attach reference images if provided
        // We handle base64 strings (stripping prefix if needed is handled in App.tsx usually, but double checking here is good)
        if (options.referenceImages) {
            options.referenceImages.forEach(img => {
                if (!img) return;
                // Ensure raw base64
                const b64 = img.includes('base64,') ? img.split('base64,')[1] : img;
                parts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: b64
                    }
                });
            });
        }

        const payload = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                candidateCount: 1,
                // Nested imageConfig based on Gemini 3 Pro Image Preview requirements
                imageConfig: {
                    imageSize: options.resolution ? options.resolution.toUpperCase() : '2K', // Default to 2K
                    aspectRatio: options.aspectRatio
                }
            }
        };

        const response = await safeApiRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`Google API Error (${response.status}):`, err);
            // If 404, it means model not found or endpoint mismatch
            if (response.status === 404) {
                return { ok: false, error: `Google Model Not Found (404). Check API Key access or Model ID.` };
            }
            return { ok: false, error: `Google (${response.status}): ${err}` };
        }

        const data = await response.json();
        console.log("Google API Response:", data);

        // Standard Gemini Response (REST JSON is usually camelCase: inlineData)
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            for (const part of data.candidates[0].content.parts) {
                // Check camelCase (REST default)
                if (part.inlineData && part.inlineData.data) {
                    return { ok: true, b64_json: part.inlineData.data };
                }
                // Check snake_case (sometimes seen in other contexts/SDKs)
                if (part.inline_data && part.inline_data.data) {
                    return { ok: true, b64_json: part.inline_data.data };
                }
            }
        }

        // Fallback for older/different structure
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            return { ok: true, b64_json: data.predictions[0].bytesBase64Encoded };
        }

        console.error("Invalid Google Response Structure:", data);
        return { ok: false, error: "Invalid Google response structure. Check console." };

    } catch (e: any) {
        console.error("GenerateGoogle Exception:", e);
        return { ok: false, error: e.message };
    }
};

export const generateImage = async (options: ImageGenerationOptions): Promise<ImageGenerationResult> => {
    if (options.provider === 'wavespeed') {
        return generateWavespeed(options);
    } else {
        return generateGoogle(options);
    }
};
