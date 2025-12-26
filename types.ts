
export type Language = 'en' | 'mm';

export type Step = 1 | 2 | 3 | 4;

export interface Message {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface AppState {
  step: Step;
  apiKey: string;
  garmentImage: string | null;
  gender: 'male' | 'female' | 'unisex' | null;
  step2Tab: 'chat' | 'expert'; // New state for Step 2 separation
  chatHistory: Message[];
  pinterestKeywords: string[];
  keywordImages: (string | null)[]; // Stores images for the 8 keyword categories
  poseRef: string | null;
  faceRef: string | null;
  bgRef: string | null;
  accessories: string;
  finalImage: string | null;
  isGenerating: boolean;
  masterPrompt: string;
  error: string | null;
  isSettingsOpen: boolean;
  loadingKeywordIndex: number | null; // Tracks which specific keyword is regenerating
}

export interface Translations {
  [key: string]: {
    en: string;
    mm: string;
  };
}
