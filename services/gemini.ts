
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION_EN, SYSTEM_INSTRUCTION_MM, KEYWORD_LABELS } from "../constants";

// Helper to delay execution for exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust retry wrapper for handling rate limits (429)
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
        // Wait longer each time: 2s, 5s...
        const waitTime = Math.pow(2.5, i + 1) * 1000;
        console.warn(`Rate limit hit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error:", error);
  let message = error instanceof Error ? error.message : "An unknown error occurred.";
  
  if (message.includes("403") || message.includes("API key")) {
    message = "Access Denied: Invalid or restricted API Key. Please ensure you have selected a valid project key.";
  } else if (message.includes("429")) {
    message = "System Busy: Rate limit exceeded. We tried retrying, but the server is still busy. Please wait 60 seconds.";
  } else if (message.includes("503") || message.includes("Overloaded")) {
    message = "Gemini Service Overloaded. Please try again shortly.";
  } else if (message.includes("SAFETY")) {
    message = "Request blocked by AI safety filters. Please modify your input.";
  }

  throw new Error(message);
};

export const analyzeGarment = async (
  base64Image: string,
  language: 'en' | 'mm',
  gender: 'male' | 'female' | 'unisex' | null
) => {
  const ai = getAI();
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
    // Use explicit GenerateContentResponse type to fix unknown property access
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            { text: prompt }
        ]
      },
      config: {
        systemInstruction: instruction,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }));
    // Property .text is correctly accessed as a getter
    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
};

export const generateKeywords = async (
    chatHistory: { role: string; text: string }[],
    language: 'en' | 'mm'
  ) => {
    const ai = getAI();
    const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
    const prompt = `Based on the following conversation about a fashion shoot, generate a highly specific Pinterest search query (English) for EACH of the following 8 categories.
    
    Categories: 1. Pose, 2. Model Face, 3. Hair Style, 4. Background, 5. Vibe, 6. Location, 7. Lighting, 8. Composition.

    Conversation:
    ${historyText}
    
    Return ONLY a JSON array of 8 strings.`;
  
    try {
      // Use explicit GenerateContentResponse type to fix unknown property access
      const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }));
      // Access text property directly from GenerateContentResponse
      return JSON.parse(response.text || "[]");
    } catch (error: any) {
      console.warn("Keywords Error:", error);
      return ["Model Pose", "Model Face", "Hairstyle", "Background", "Vibe", "Shoot Location", "Lighting", "Composition"];
    }
  };

export const regenerateSingleKeyword = async (
  chatHistory: { role: string; text: string }[],
  category: string,
  currentKeyword: string
) => {
  const ai = getAI();
  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  const prompt = `Generate a NEW alternative Pinterest keyword for "${category}" based on this context: ${historyText}. Current: ${currentKeyword}. Return string only.`;

  try {
    // Use explicit GenerateContentResponse type to fix unknown property access
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    }));
    // Access text property directly from GenerateContentResponse
    return response.text?.trim() || currentKeyword;
  } catch (error) {
    return currentKeyword;
  }
};

export const summarizeChat = async (
  chatHistory: { role: string; text: string }[],
  language: 'en' | 'mm'
) => {
  const ai = getAI();
  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  const instruction = language === 'mm' 
    ? "အတည်ပြုပြီးသော အချက်လက်များကိုသာ စာရင်းပြုစုပေးပါ။"
    : "Summarize ONLY the final confirmed decisions for Vibe, Location, Model, Styling, etc.";

  try {
    // Use explicit GenerateContentResponse type to fix unknown property access
    const response: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Conversation History:\n${historyText}\n\nTask: ${instruction}`,
    }));
    // Access text property directly from GenerateContentResponse
    return response.text;
  } catch (error) {
    return "Failed to summarize.";
  }
};

export const generateFashionImage = async (
  garment: string,
  keywordImages: (string | null)[],
  accessories: string,
  keywords: string[],
  chatContext: string
) => {
  const ai = getAI();
  
  // Prepare contents for text model
  const textParts: any[] = [{ inlineData: { mimeType: "image/jpeg", data: garment } }];
  keywordImages.forEach((img) => { if (img) textParts.push({ inlineData: { mimeType: "image/jpeg", data: img } }); });
  
  const structureInstruction = `Generate a Master Prompt for this shoot: Subject details, Outfit styling, Setting/Background, and Vibe/Camera style. Context: ${chatContext}. Accessories: ${accessories}.`;
  textParts.push({ text: structureInstruction });

  // Prepare contents for image model
  const imageParts: any[] = [
    { text: "MAIN SUBJECT CLOTHING (Must wear this):" },
    { inlineData: { mimeType: "image/jpeg", data: garment } }
  ];
  keywordImages.forEach((img, idx) => { if (img) imageParts.push({ text: `Ref: ${KEYWORD_LABELS['en'][idx]}`, inlineData: { mimeType: "image/jpeg", data: img } }); });
  imageParts.push({ text: `Generate a photorealistic fashion editorial. Style: ${chatContext}. Accessories: ${accessories}.` });

  try {
    // Run sequentially with slight delay to avoid bursting quota limits
    // Explicitly typing textResponse as GenerateContentResponse
    const textResponse: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: textParts },
    }));

    // Small staggered delay to prevent immediate 429 on free tier
    await delay(1000);

    // Explicitly typing imageResponse as GenerateContentResponse
    const imageResponse: GenerateContentResponse = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: imageParts },
    }));
    
    let finalImageBase64 = null;
    // Fix candidates access on unknown type error
    const candidates = imageResponse.candidates;
    if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
            // Find the image part as per guidelines
            if (part.inlineData) {
                finalImageBase64 = part.inlineData.data;
                break;
            }
        }
    }
    if (!finalImageBase64) throw new Error("Image generation failed to return data.");

    return {
        image: finalImageBase64,
        // Access text property directly from GenerateContentResponse
        prompt: textResponse.text?.trim() || "N/A"
    };

  } catch (error) {
    handleGeminiError(error);
  }
};
