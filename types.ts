
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
  proxyUrl: string; // New field for Myanmar proxy support
  garmentImage: string | null;
  gender: 'male' | 'female' | 'unisex' | null;
  step2Tab: 'chat' | 'expert';
  chatHistory: Message[];
  pinterestKeywords: string[];
  keywordImages: (string | null)[];
  poseRef: string | null;
  faceRef: string | null;
  bgRef: string | null;
  accessories: string;
  finalImage: string | null;
  isGenerating: boolean;
  masterPrompt: string;
  error: string | null;
  isSettingsOpen: boolean;
  loadingKeywordIndex: number | null;
}

export interface Translations {
  [key: string]: {
    en: string;
    mm: string;
  };
}
