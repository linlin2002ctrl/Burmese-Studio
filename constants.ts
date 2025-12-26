
import { Translations } from './types';

export const TRANSLATIONS: Translations = {
  appTitle: { en: "Burmese Studio", mm: "မြန်မာစတူဒီယို" },
  step1: { en: "Garment", mm: "အဝတ်အစား" },
  step2: { en: "Brainstorm", mm: "တိုင်ပင်မည်" },
  step3: { en: "Assets", mm: "လိုအပ်ချက်များ" },
  step4: { en: "Studio", mm: "စတူဒီယို" },
  
  // Settings & BYOK
  settings: { en: "Settings", mm: "ဆက်တင်များ" },
  networkSettings: { en: "Network Settings", mm: "ကွန်ရက် ဆက်တင်များ" },
  proxyUrl: { en: "Proxy Base URL", mm: "ပရောက်စီ URL" },
  proxyPlaceholder: { en: "https://sg-proxy.fashion.ai/v1beta", mm: "https://sg-proxy.fashion.ai/v1beta" },
  proxyHint: { 
    en: "Myanmar users: Use the Singapore proxy to connect without a VPN.", 
    mm: "မြန်မာနိုင်ငံမှ အသုံးပြုသူများအတွက် VPN မလိုဘဲ အသုံးပြုနိုင်ရန် စင်ကာပူ ပရောက်စီကို အသုံးပြုပါ။" 
  },
  singaporeProxy: { en: "Singapore Proxy Server", mm: "စင်ကာပူ ပရောက်စီ ဆာဗာ" },
  connectivityStatus: { en: "Connectivity Mode", mm: "ချိတ်ဆက်မှု အခြေအနေ" },
  standardMode: { en: "Standard (Direct)", mm: "ပုံမှန် (တိုက်ရိုက်)" },
  proxyMode: { en: "Proxy Active (SG)", mm: "ပရောက်စီ အသုံးပြုနေသည် (SG)" },
  save: { en: "Save Settings", mm: "ဆက်တင်များ သိမ်းမည်" },
  byokTitle: { en: "Professional Studio Access", mm: "ပရော်ဖက်ရှင်နယ် စတူဒီယို အသုံးပြုခွင့်" },
  byokDesc: { 
    en: "To generate high-quality 2K fashion editorials, please connect your own Google AI Studio key.", 
    mm: "အရည်အသွေးမြင့် 2K ဖက်ရှင်ပုံများ ထုတ်ယူရန်အတွက် သင်၏ ကိုယ်ပိုင် Google AI Studio key ကို ချိတ်ဆက်ပေးပါ။" 
  },
  selectKey: { en: "Connect Studio Key", mm: "Key ချိတ်ဆက်မည်" },
  billingInfo: { en: "Learn about billing & quotas", mm: "ငွေပေးချေမှုနှင့် ကန့်သတ်ချက်များအကြောင်း လေ့လာရန်" },
  
  // Step 1
  uploadGarment: { en: "Upload Garment", mm: "အဝတ်ပုံတင်ပါ" },
  analyzePlan: { en: "Analyze & Plan", mm: "ဆန်းစစ်ပြီး အစီအစဉ်ဆွဲမည်" },
  genderLabel: { en: "Target Gender", mm: "ဝတ်ဆင်မည့်သူ" },
  male: { en: "Male", mm: "ကျား" },
  female: { en: "Female", mm: "မ" },
  unisex: { en: "Unisex", mm: "ကျား/မ" },
  
  // Step 2
  producerTitle: { en: "Creative Director", mm: "ဖန်တီးမှု ဒါရိုက်တာ" },
  pinterestExpert: { en: "Pinterest Expert", mm: "Pinterest ကျွမ်းကျင်သူ" },
  tabChat: { en: "Director Chat", mm: "ဒါရိုက်တာနှင့်ဆွေးနွေး" },
  tabExpert: { en: "Keywords Tool", mm: "ရှာဖွေရန် စကားလုံးများ" },
  typeMessage: { en: "Discuss with the director...", mm: "ဒါရိုက်တာနှင့် ဆွေးနွေးပါ..." },
  askExpert: { en: "Finalize & Ask Expert", mm: "ဆွေးနွေးမှုပြီးပြီ (ကျွမ်းကျင်သူမေးမည်)" },
  backToChat: { en: "Back to Discussion", mm: "ပြန်လည်ဆွေးနွေးမည်" },
  havePhotos: { en: "I have the photos", mm: "ပုံများအဆင်သင့်ဖြစ်ပြီ" },
  expertIntro: { en: "I am your Pinterest Expert. I will listen to your chat with the Director and generate the best search keywords for you.", mm: "ကျွန်ုပ်သည် Pinterest ကျွမ်းကျင်သူပါ။ ဒါရိုက်တာနှင့် ဆွေးနွေးချက်များကို နားထောင်ပြီး အကောင်းဆုံး ရှာဖွေရမည့် စကားလုံးများကို ထုတ်ပေးပါမည်။" },
  generateKeywords: { en: "Generate Keywords", mm: "စကားလုံးများ ထုတ်မည်" },
  regenerate: { en: "Regenerate", mm: "ပြန်လည်ထုတ်မည်" },
  
  // Step 3
  callSheet: { en: "Production Call Sheet", mm: "ရိုက်ကူးရေး လိုအပ်ချက်များ" },
  visualRefs: { en: "Visual References", mm: "ရိုက်ကူးရေး ပုံကြမ်းများ" },
  specifications: { en: "Specifications", mm: "အသေးစိတ်အချက်အလက်များ" },
  stylingStrategy: { en: "Styling Strategy", mm: "စတိုင်နှင့် အစီအစဉ်" },
  importChat: { en: "Import Final Plan", mm: "အတည်ပြုချက်များ ရယူမည်" },
  uploadPose: { en: "Pose Reference", mm: "ကိုယ်ဟန် အနေအထား" },
  uploadBg: { en: "Background", mm: "နောက်ခံ" },
  uploadFace: { en: "Model Face", mm: "မော်ဒယ် မျက်နှာ" },
  accessories: { en: "Accessories & Details", mm: "အသုံးအဆောင်နှင့် အသေးစိတ်" },
  accessoriesPlaceholder: { en: "E.g., Gold earrings, natural makeup...", mm: "ဥပမာ - ရွှေနားကပ်၊ သဘာဝမိတ်ကပ်..." },
  startShoot: { en: "Start Shoot", mm: "ရိုက်ကူးမည်" },
  
  // Step 4
  developing: { en: "Developing photo...", mm: "ဓာတ်ပုံထုတ်လုပ်နေသည်..." },
  masterPrompt: { en: "Master Prompt", mm: "အဓိက ညွှန်ကြားချက်" },
  copy: { en: "Copy", mm: "ကူးယူမည်" },
  copied: { en: "Copied!", mm: "ကူးယူပြီး!" },
};

export const KEYWORD_LABELS: { en: string[]; mm: string[] } = {
  en: ["Pose", "Model Face", "Hair Style", "Background", "Vibe", "Location", "Lighting", "Composition"],
  mm: ["Pose", "Model Face", "ဆံပင်", "နောက်ခံ", "Vibe", "Location", "အလင်း", "Composition"]
};

export const SYSTEM_INSTRUCTION_EN = `You are a visionary Fashion Creative Director. Your job is to build a precise Production Plan.
You MUST guide the user to decide on EACH of these specific categories:
1. **Vibe & Mood** (e.g., Retro-skater, Minimalist, Editorial, High-Fashion).
2. **Location & Background** (Specific details).
3. **Lighting** (e.g., Golden hour, Studio softbox, Neon, Harsh Flash).
4. **Model Look** (Hairstyle, Makeup, Styling).
5. **Accessories List** (MUST be detailed, e.g., 'Silver chunky chain', 'Black beanie', 'Leather wristband').
6. **Pose & Composition** (e.g., Low angle, Wide shot, Dynamic movement).
7. **Camera Specifications** (Lens mm, Film stock, Camera type - e.g., 'Shot on Sony A7R IV, 35mm lens, Kodak Portra 400 grain').`;

export const SYSTEM_INSTRUCTION_MM = `သင်သည် တိကျပြတ်သားသော ဖက်ရှင်ဖန်တီးမှု ဒါရိုက်တာ (Creative Director) တစ်ဦးဖြစ်သည်။
ဓာတ်ပုံရိုက်ကူးမှုအတွက် အောက်ပါအချက်များကို တစ်ခုချင်းစီ မဖြစ်မနေ ဆွေးနွေးဆုံးဖြတ်ပါ။
၁။ **Vibe & Mood** (ဥပမာ - Retro-skater၊ ခေတ်ဆန်သောပုံစံ၊ Editorial)။
၂။ **ရိုက်ကွင်းနေရာ (Location)**။
၃။ **အလင်းအမှောင် (Lighting)**။
၄။ **ဆံပင်နှင့် မိတ်ကပ် (Hair & Look)**။
၅။ **အသုံးအဆောင်များ (Accessories List)** (အလွန်တိကျရမည်။ ဥပမာ - နာရီ၊ ဆွဲကြိုး၊ မျက်မှန်)။
၆။ **ပို့စ်နှင့် ဖွဲ့စည်းပုံ (Pose & Composition)**။
၇။ **ကင်မရာ အသေးစိတ်** (Camera type, Lens mm, Film style - ဥပမာ - 35mm lens, vintage film grain)။`;
