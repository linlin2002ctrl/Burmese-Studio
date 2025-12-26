
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION_EN, SYSTEM_INSTRUCTION_MM, KEYWORD_LABELS } from "../constants";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create client with the user's key (or env fallback) and proxy settings
const getGeminiClient = (apiKey: string, proxyUrl?: string) => {
  const keyToUse = apiKey && apiKey.trim() !== "" ? apiKey : (process.env.API_KEY || "");
  return new GoogleGenAI({ 
    apiKey: keyToUse,
    // @ts-ignore - Handle base URL for proxying
    baseUrl: proxyUrl || undefined 
  });
};

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.toLowerCase().includes("too many requests");
      
      if (isRateLimit && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i + 1) * 1000;
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error:", error);
  let message = error instanceof Error ? error.message : "An unknown error occurred.";
  
  if (message.includes("429")) {
    message = "Rate Limit Exceeded: Please wait a moment or check your API quota.";
  } else if (message.includes("403") || message.includes("API key")) {
    message = "Authentication Failed: Please check your API Key in Settings.";
  } else if (message.includes("Requested entity was not found")) {
    message = "PROJECT_NOT_FOUND: Please provide a valid API key in settings.";
  } else if (message.includes("Budget 0 is invalid")) {
    message = "Model Configuration Error: This model requires thinking mode.";
  }

  throw new Error(message);
};

export const analyzeGarment = async (
  apiKey: string,
  base64Image: string,
  language: 'en' | 'mm',
  gender: 'male' | 'female' | 'unisex' | null,
  proxyUrl?: string
) => {
  const ai = getGeminiClient(apiKey, proxyUrl);
  const instruction = language === 'mm' ? SYSTEM_INSTRUCTION_MM : SYSTEM_INSTRUCTION_EN;

  let prompt = "";
  if (language === 'mm') {
      const genderText = gender === 'male' ? 'အမျိုးသား' : gender === 'female' ? 'အမျိုးသမီး' : 'ကျား/မ မရွေး';
      prompt = `ဤအဝတ်အစား(${genderText} ဝတ်)ကို ကြည့်ရှုပြီး ဓာတ်ပုံရိုက်ကူးရန် အကြံဉာဏ်များပေးပါ။`;
  } else {
      const genderText = gender ? gender : 'Unisex';
      prompt = `Analyze this garment (Target Audience: ${genderText}) and suggest a creative direction for a photoshoot.`;
  }

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            { text: prompt }
        ]
      },
      config: {
        systemInstruction: instruction,
        // Removed thinkingBudget: 0 to fix INVALID_ARGUMENT error
      }
    }));
    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
};

export const generateKeywords = async (
    apiKey: string,
    chatHistory: { role: string; text: string }[],
    language: 'en' | 'mm',
    proxyUrl?: string
  ) => {
    const ai = getGeminiClient(apiKey, proxyUrl);
    const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
    const prompt = `Based on the following conversation about a fashion shoot, generate a highly specific Pinterest search query (English) for EACH of the following 8 categories.
    
    Categories: 1. Pose, 2. Model Face, 3. Hair Style, 4. Background, 5. Vibe, 6. Location, 7. Lighting, 8. Composition.

    Conversation:
    ${historyText}
    
    Return ONLY a JSON array of 8 strings.`;
  
    try {
      const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }));
      return JSON.parse(response.text || "[]");
    } catch (error: any) {
      return ["Model Pose", "Model Face", "Hairstyle", "Background", "Vibe", "Shoot Location", "Lighting", "Composition"];
    }
  };

export const regenerateSingleKeyword = async (
  apiKey: string,
  chatHistory: { role: string; text: string }[],
  category: string,
  currentKeyword: string,
  proxyUrl?: string
) => {
  const ai = getGeminiClient(apiKey, proxyUrl);
  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  const prompt = `Generate a NEW alternative Pinterest keyword for "${category}" based on this context: ${historyText}. Current: ${currentKeyword}. Return string only.`;

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    }));
    return response.text?.trim() || currentKeyword;
  } catch (error) {
    return currentKeyword;
  }
};

export const summarizeChat = async (
  apiKey: string,
  chatHistory: { role: string; text: string }[],
  language: 'en' | 'mm',
  proxyUrl?: string
) => {
  const ai = getGeminiClient(apiKey, proxyUrl);
  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  const instruction = language === 'mm' 
    ? "အတည်ပြုပြီးသော အချက်လက်များကိုသာ စာရင်းပြုစုပေးပါ။"
    : "Summarize ONLY the final confirmed decisions for Vibe, Location, Model, Styling, etc.";

  try {
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Conversation History:\n${historyText}\n\nTask: ${instruction}`,
    }));
    return response.text;
  } catch (error) {
    return "Failed to summarize.";
  }
};

export const generateFashionImage = async (
  apiKey: string,
  garment: string,
  keywordImages: (string | null)[],
  accessories: string,
  keywords: string[],
  chatContext: string,
  proxyUrl?: string
) => {
  const ai = getGeminiClient(apiKey, proxyUrl);
  
  const textParts: any[] = [{ inlineData: { mimeType: "image/jpeg", data: garment } }];
  keywordImages.forEach((img) => { if (img) textParts.push({ inlineData: { mimeType: "image/jpeg", data: img } }); });
  
  const structureInstruction = `Generate a Master Prompt for this shoot: Subject details, Outfit styling, Setting/Background, and Vibe/Camera style. Context: ${chatContext}. Accessories: ${accessories}.`;
  textParts.push({ text: structureInstruction });

  const imageParts: any[] = [
    { text: "MAIN SUBJECT CLOTHING (Must wear this):" },
    { inlineData: { mimeType: "image/jpeg", data: garment } }
  ];
  keywordImages.forEach((img, idx) => { if (img) imageParts.push({ text: `Ref: ${KEYWORD_LABELS['en'][idx]}`, inlineData: { mimeType: "image/jpeg", data: img } }); });
  imageParts.push({ text: `Generate a photorealistic fashion editorial. Style: ${chatContext}. Accessories: ${accessories}. 2K Resolution, high quality.` });

  try {
    const textResponse: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: { parts: textParts },
    }));

    await delay(2000); 

    const imageResponse: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: imageParts },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            imageSize: "2K"
          }
        }
    }));
    
    let finalImageBase64 = null;
    const candidates = imageResponse.candidates;
    if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
                finalImageBase64 = part.inlineData.data;
                break;
            }
        }
    }
    if (!finalImageBase64) throw new Error("Image generation failed to return data.");

    return {
        image: finalImageBase64,
        prompt: textResponse.text?.trim() || "N/A"
    };

  } catch (error) {
    handleGeminiError(error);
  }
};
