import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION_EN, SYSTEM_INSTRUCTION_MM, KEYWORD_LABELS } from "../constants";

export const createClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

// Helper to sanitize Gemini errors
const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error:", error);
  
  let message = error instanceof Error ? error.message : "An unknown error occurred.";
  
  // Map common error codes/messages to user-friendly strings
  if (message.includes("403") || message.includes("API key")) {
    message = "Access Denied: Invalid API Key. Please check your settings.";
  } else if (message.includes("429")) {
    message = "System Busy: Too many requests. Please wait a moment.";
  } else if (message.includes("503") || message.includes("Overloaded")) {
    message = "Gemini Service Overloaded. Please try again shortly.";
  } else if (message.includes("SAFETY")) {
    message = "Request blocked by AI safety filters. Please modify your input.";
  } else if (message.includes("400")) {
    message = "Invalid Request. Please check your inputs.";
  }

  throw new Error(message);
};

export const analyzeGarment = async (
  apiKey: string,
  base64Image: string,
  language: 'en' | 'mm',
  gender: 'male' | 'female' | 'unisex' | null
) => {
  const client = createClient(apiKey);
  const modelId = "gemini-3-flash-preview"; 
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
    const response = await client.models.generateContent({
      model: modelId,
      contents: {
        parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            { text: prompt }
        ]
      },
      config: {
        systemInstruction: instruction,
      }
    });
    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
};

export const generateKeywords = async (
    apiKey: string,
    chatHistory: { role: string; text: string }[],
    language: 'en' | 'mm'
  ) => {
    const client = createClient(apiKey);
    const modelId = "gemini-3-flash-preview";
    
    // Construct context from chat history
    const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
    const prompt = `Based on the following conversation about a fashion shoot, generate a highly specific Pinterest search query (English) for EACH of the following 8 categories.
    
    Categories (In this exact order):
    1. Pose
    2. Model Face
    3. Hair Style
    4. Background
    5. Vibe (e.g., "Retro-skater vibe")
    6. Location
    7. Lighting
    8. Composition

    Conversation:
    ${historyText}
    
    Return ONLY a JSON array of 8 strings, strictly corresponding to the order above.
    Example: ["Dynamic High Fashion Pose", "Edgy Makeup with Bleached Brows", "Messy Mullet Hair", "Graffiti Concrete Wall", "90s Grunge Vibe", "Abandoned Skatepark", "Neon Red Gel Lighting", "Low Angle Fish-eye"]`;
  
    try {
      const response = await client.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error: any) {
      // If it's an auth error, we should let the user know.
      if (error.message?.includes("API key") || error.message?.includes("403")) {
        handleGeminiError(error);
      }
      // Otherwise, gracefully degrade for this specific feature
      console.warn("Keywords Error (using fallback):", error);
      return [
          "Model Pose Reference", "Model Face & Makeup", "Hairstyle Reference", "Background Reference", 
          "Overall Vibe", "Shoot Location", "Lighting Reference", "Composition Idea"
      ];
    }
  };

export const regenerateSingleKeyword = async (
  apiKey: string,
  chatHistory: { role: string; text: string }[],
  category: string,
  currentKeyword: string
) => {
  const client = createClient(apiKey);
  const modelId = "gemini-3-flash-preview";

  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  const prompt = `
    Context: A conversation about a fashion shoot.
    The user is trying to find visual references on Pinterest.
    
    Category: "${category}"
    Current Failed Keyword: "${currentKeyword}"
    
    The user reported that the current keyword didn't give good results or wasn't searchable.
    Generate a NEW, ALTERNATIVE, HIGHLY SEARCHABLE English keyword for this category that matches the context.
    Make it simpler or use different terminology if the previous one was too complex.
    
    Conversation Reference:
    ${historyText}
    
    Return ONLY the new keyword string. No quotes, no markdown.
  `;

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text?.trim() || currentKeyword;
  } catch (error) {
    handleGeminiError(error);
    return currentKeyword;
  }
};

export const summarizeChat = async (
  apiKey: string,
  chatHistory: { role: string; text: string }[],
  language: 'en' | 'mm'
) => {
  const client = createClient(apiKey);
  const modelId = "gemini-3-flash-preview";

  const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
  
  const instruction = language === 'mm' 
    ? "ဤဆွေးနွေးမှုမှတ်တမ်းမှ အတည်ပြုပြီးသော အချက်လက်များကိုသာ စာရင်းပြုစုပေးပါ။ (Vibe, Location, Model, Styling, etc.)။ အစအဆုံး ဆွေးနွေးမှုများကို ထည့်သွင်းရန်မလိုပါ။ နောက်ဆုံး ဆုံးဖြတ်ချက်ကိုသာ တိုတိုနှင့် လိုရင်းကို ရေးပါ။"
    : "Summarize the FINAL agreed plan from this conversation. Ignore the brainstorming process/debate. List only the confirmed decisions for Vibe, Location, Model, Styling, etc. Keep it concise.";

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: `Conversation History:\n${historyText}\n\nTask: ${instruction}`,
    });
    return response.text;
  } catch (error) {
    handleGeminiError(error);
    return ""; // Fallback
  }
};

export const generateFashionImage = async (
  apiKey: string,
  garment: string,
  keywordImages: (string | null)[],
  accessories: string,
  keywords: string[],
  chatContext: string
) => {
  const client = createClient(apiKey);
  
  // Model IDs
  const imageModelId = "gemini-2.5-flash-image"; 
  const textModelId = "gemini-3-flash-preview";

  // --- 1. Prepare Inputs for Image Generation ---
  const imageParts: any[] = [];
  
  // The Garment is mandatory
  imageParts.push({ text: "MAIN SUBJECT CLOTHING (Must wear this):" });
  imageParts.push({ inlineData: { mimeType: "image/jpeg", data: garment } });

  // Add keyword images dynamically
  const categories = KEYWORD_LABELS['en'];
  keywordImages.forEach((img, index) => {
    if (img) {
      imageParts.push({ text: `Reference for ${categories[index]}:` });
      imageParts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
    }
  });

  // Reconstruct details for the Image Prompt
  const keywordSpecs = keywords.map((k, i) => k ? `${categories[i]}: ${k}` : null).filter(Boolean).join('\n');
  const contextForImage = `
    ACCESSORIES & STYLING NOTES: ${accessories || "None/Minimal"}
    PLANNED SPECIFICATIONS:
    ${keywordSpecs}
  `;

  const imagePrompt = `
    Generate a high-quality, photorealistic fashion editorial image.
    INSTRUCTIONS:
    - The subject MUST be wearing the provided 'MAIN SUBJECT CLOTHING'.
    - Use the other provided reference images to guide the specific details (Pose, Face, Lighting, Background, etc.).
    - If a specific reference image is missing, infer the style from the 'PLANNED SPECIFICATIONS' and 'CHAT CONTEXT'.
    
    ${contextForImage}
    
    CHAT CONTEXT: ${chatContext}
    
    Output a single photorealistic image.
  `;
  imageParts.push({ text: imagePrompt });

  // --- 2. Prepare Inputs for Structured Text Generation ---
  const textParts: any[] = [];
  // We pass images to the text model too
  textParts.push({ inlineData: { mimeType: "image/jpeg", data: garment } });
  keywordImages.forEach((img) => {
    if (img) textParts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
  });
  
  // --- Dynamic Template Construction ---
  // We build the expected template structure based on what inputs the user actually provided.
  const templateSegments = [];
  
  templateSegments.push("SUBJECT: [Model details, hair, makeup]");
  
  if (accessories && accessories.trim().length > 0) {
    templateSegments.push("OUTFIT: [Garment name] styled with [Accessories list from notes]");
  } else {
    templateSegments.push("OUTFIT: [Garment name] (Focus on garment, minimal additional styling)");
  }

  // Check if we have specific setting inputs (Background=3, Location=5, Lighting=6)
  const hasSettingInput = keywords[3] || keywords[5] || keywords[6];
  if (hasSettingInput) {
    templateSegments.push("SETTING: [Detailed background, location, and lighting based on references]");
  } else {
    templateSegments.push("SETTING: [Background/Location inferred from Vibe]");
  }
  
  templateSegments.push("STYLE: [Vibe, composition, camera]");

  const dynamicTemplate = templateSegments.join(" | ");

  const structureInstruction = `
    You are a technical creative director. Analyze the provided images and the context below.
    Generate a STRUCTURED MASTER PROMPT following this EXACT structure:
    
    ${dynamicTemplate}

    Context from chat: ${chatContext}
    User Accessories/Notes: ${accessories}
    Planned Keywords: ${keywordSpecs}

    Do not include any preamble. Output ONLY the formatted string.
  `;
  textParts.push({ text: structureInstruction });


  try {
    // Execute both requests in parallel
    const [imageResponse, textResponse] = await Promise.all([
        client.models.generateContent({
            model: imageModelId,
            contents: { parts: imageParts },
        }),
        client.models.generateContent({
            model: textModelId,
            contents: { parts: textParts },
        })
    ]);
    
    // --- Process Image Response ---
    let finalImageBase64 = null;
    const candidates = imageResponse.candidates;
    if (candidates && candidates.length > 0) {
        const parts = candidates[0].content.parts;
        for (const part of parts) {
            if (part.inlineData) {
                finalImageBase64 = part.inlineData.data;
                break;
            }
        }
    }
    if (!finalImageBase64) throw new Error("The model generated a response but no image was found.");

    // --- Process Text Response ---
    let structuredPrompt = textResponse.text ? textResponse.text.trim() : "SUBJECT: N/A | OUTFIT: N/A | SETTING: N/A | STYLE: N/A";

    return {
        image: finalImageBase64,
        prompt: structuredPrompt 
    };

  } catch (error) {
    handleGeminiError(error);
  }
};
