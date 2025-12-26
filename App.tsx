import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, Moon, Send, Sparkles, ChevronRight, Copy, Check, Loader2, Camera, X, AlertCircle, ArrowDownToLine, ImageIcon, FileText, Settings, Search, RefreshCcw, MessageSquare, ListChecks
} from 'lucide-react';
import { AppState, Message, Language, Step } from './types';
import { TRANSLATIONS, KEYWORD_LABELS } from './constants';
import * as GeminiService from './services/gemini';
import FileUpload from './components/FileUpload';

// Helper to strip base64 prefix for Gemini API
const stripBase64 = (dataUrl: string | null) => {
  if (!dataUrl) return null;
  return dataUrl.split(',')[1];
};

const App: React.FC = () => {
  // --- State ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<Language>('en');
  const [state, setState] = useState<AppState>({
    step: 1,
    apiKey: '',
    garmentImage: null,
    gender: null,
    step2Tab: 'chat',
    chatHistory: [],
    pinterestKeywords: [],
    keywordImages: new Array(8).fill(null), // Stores images for the 8 keyword categories
    poseRef: null, // Deprecated in favor of keywordImages[0]
    faceRef: null, // Deprecated in favor of keywordImages[1]
    bgRef: null,   // Deprecated in favor of keywordImages[3]
    accessories: '',
    finalImage: null,
    isGenerating: false,
    masterPrompt: '',
    error: null,
    isSettingsOpen: false,
    loadingKeywordIndex: null
  });
  
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    // Theme initialization
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Theme toggle class
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Scroll to bottom of chat
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory, state.step2Tab]);

  const t = (key: string) => TRANSLATIONS[key][lang];

  // --- Handlers ---

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLang = () => setLang(prev => prev === 'en' ? 'mm' : 'en');

  const handleNextStep = () => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, 4) as Step }));
  };

  const handleBackStep = () => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) as Step }));
  };

  const handleError = (e: any) => {
    const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
    setState(prev => ({ ...prev, isGenerating: false, error: msg }));
    setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
    }, 6000);
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const handleKeywordImageChange = (index: number, base64: string | null) => {
    setState(prev => {
        const newImages = [...prev.keywordImages];
        newImages[index] = base64;
        return { ...prev, keywordImages: newImages };
    });
  };

  const startAnalysis = async () => {
    if (!state.apiKey) {
        handleError(new Error("Please enter your Gemini API Key first."));
        setState(prev => ({ ...prev, isSettingsOpen: true }));
        return;
    }
    if (!state.garmentImage) {
        handleError(new Error("Please upload a garment image."));
        return;
    }
    if (!state.gender) {
        handleError(new Error(lang === 'mm' ? "ကျား/မ ရွေးချယ်ပေးပါ။" : "Please select a gender."));
        return;
    }
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const response = await GeminiService.analyzeGarment(
        state.apiKey, 
        stripBase64(state.garmentImage)!, 
        lang,
        state.gender
      );
      
      const initialMessage: Message = { role: 'model', text: response || "Ready to plan." };
      
      setState(prev => ({
        ...prev,
        step: 2,
        step2Tab: 'chat',
        isGenerating: false,
        chatHistory: [initialMessage]
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    if (!state.apiKey) {
        handleError(new Error("API Key is missing."));
        setState(prev => ({ ...prev, isSettingsOpen: true }));
        return;
    }
    
    const userMsg: Message = { role: 'user', text: chatInput };
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMsg]
    }));
    setChatInput('');
    
    try {
        const client = GeminiService.createClient(state.apiKey);
        const modelId = "gemini-3-flash-preview";
        
        const history = state.chatHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));
        
        const chat = client.chats.create({
            model: modelId,
            history: history,
            config: {
                systemInstruction: lang === 'mm' ? 
                    "Respond in Burmese. You are a fashion producer." : 
                    "Respond in English. You are a fashion producer."
            }
        });
        
        const result = await chat.sendMessage({ message: userMsg.text });
        
        setState(prev => ({
            ...prev,
            chatHistory: [...prev.chatHistory, userMsg, { role: 'model', text: result.text }]
        }));

    } catch (e: any) {
        handleError(e);
    }
  };

  const generateKeywords = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
        const keywords = await GeminiService.generateKeywords(state.apiKey, state.chatHistory, lang);
        setState(prev => ({ ...prev, pinterestKeywords: keywords, isGenerating: false }));
    } catch (e) {
        handleError(e);
    }
  };

  const handleSingleRegenerate = async (index: number) => {
    if (!state.apiKey) return;
    
    setState(prev => ({ ...prev, loadingKeywordIndex: index, error: null }));
    
    const category = KEYWORD_LABELS['en'][index]; 
    const currentKeyword = state.pinterestKeywords[index];

    try {
        const newKeyword = await GeminiService.regenerateSingleKeyword(
            state.apiKey, 
            state.chatHistory, 
            category, 
            currentKeyword
        );
        
        setState(prev => {
            const newKeywords = [...prev.pinterestKeywords];
            newKeywords[index] = newKeyword;
            return {
                ...prev,
                pinterestKeywords: newKeywords,
                loadingKeywordIndex: null
            };
        });
    } catch (e) {
        handleError(e);
        setState(prev => ({ ...prev, loadingKeywordIndex: null }));
    }
  };

  const generateFinalImage = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
        // Construct chat context summary
        const chatContext = state.chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
        
        // Prepare image list (stripped base64)
        const strippedImages = state.keywordImages.map(img => stripBase64(img));

        const result = await GeminiService.generateFashionImage(
            state.apiKey,
            stripBase64(state.garmentImage)!,
            strippedImages,
            state.accessories, // Pass raw accessories string
            state.pinterestKeywords, // Pass raw keywords array
            chatContext
        );

        setState(prev => ({
            ...prev,
            finalImage: `data:image/jpeg;base64,${result.image}`,
            masterPrompt: result.prompt,
            isGenerating: false,
            step: 4
        }));
    } catch (e) {
        handleError(e);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(state.masterPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportChat = async () => {
    if (state.chatHistory.length === 0) return;
    setState(prev => ({ ...prev, isGenerating: true }));
    try {
        const summary = await GeminiService.summarizeChat(state.apiKey, state.chatHistory, lang);
        setState(prev => ({
            ...prev, 
            accessories: (prev.accessories ? prev.accessories + '\n\n' : '') + "--- Final Plan ---\n" + summary,
            isGenerating: false
        }));
    } catch (e) {
        handleError(e);
    }
  };

  // --- Components ---

  const PrimaryButton = ({ onClick, disabled, children, className = "" }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-full px-6 py-3 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${className}`}
    >
        {children}
    </button>
  );

  const SecondaryButton = ({ onClick, disabled, children, className = "" }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-full px-6 py-3 font-medium transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
  );

  const Label = ({ children, className = "" }: any) => (
    <label className={`text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 block ${className}`}>
        {children}
    </label>
  );

  const InputStyles = "w-full bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent outline-none transition-all placeholder-zinc-400 text-sm";

  // --- Render Functions ---

  const renderToast = () => {
    if (!state.error) return null;
    return (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm z-[60] animate-bounce-in">
            <div className="bg-red-600/90 backdrop-blur-sm text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-sm font-medium leading-tight">{state.error}</p>
                </div>
                <button onClick={clearError} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
  };

  const renderHeader = () => (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-pink-500" />
        <h1 className={`font-bold text-lg tracking-tight ${lang === 'mm' ? 'font-burmese' : 'font-sans'}`}>
          {t('appTitle')}
        </h1>
      </div>
      <div className="flex gap-2">
        <button onClick={toggleLang} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">
            <span className="font-bold text-[10px]">{lang.toUpperCase()}</span>
        </button>
        <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button 
            onClick={() => setState(prev => ({...prev, isSettingsOpen: !prev.isSettingsOpen}))} 
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${state.isSettingsOpen ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );

  const renderSettings = () => (
    <div className="flex-1 flex flex-col p-6 gap-6 animate-fade-in bg-white dark:bg-zinc-950 max-w-2xl mx-auto w-full">
        <h2 className={`text-2xl font-bold tracking-tight ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('settings')}</h2>
        <div className="space-y-6">
            <div>
                <Label>
                    {t('apiKeyLabel')} <span className="text-red-500">*</span>
                </Label>
                <input 
                    type="password" 
                    value={state.apiKey}
                    onChange={(e) => setState(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={t('apiKeyPlaceholder')}
                    className={InputStyles}
                />
            </div>
        </div>
        <div className="mt-auto">
            <PrimaryButton onClick={() => setState(prev => ({ ...prev, isSettingsOpen: false }))}>
                <div className="flex items-center justify-center gap-2">
                    <Check size={18} />
                    <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('save')}</span>
                </div>
            </PrimaryButton>
        </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 md:gap-16 animate-fade-in max-w-5xl mx-auto w-full h-full">
        <div className="w-full max-w-sm md:max-w-md aspect-[3/4] md:aspect-auto md:h-[500px]">
             <FileUpload 
                label={t('uploadGarment')}
                image={state.garmentImage}
                onImageChange={(img) => setState(prev => ({ ...prev, garmentImage: img }))}
                aspect="portrait"
                className="w-full h-full shadow-lg rounded-2xl"
            />
        </div>
        <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4 text-center md:text-left">
                <h2 className={`text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('uploadGarment')}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Upload the main garment for the photoshoot. Our AI Creative Director will analyze it and help you build a complete production plan.
                </p>
            </div>
            <div className="space-y-3">
                <Label className={lang === 'mm' ? 'font-burmese' : ''}>{t('genderLabel')}</Label>
                <div className="grid grid-cols-3 gap-3">
                    {['male', 'female', 'unisex'].map((g) => (
                        <button
                            key={g}
                            onClick={() => setState(prev => ({ ...prev, gender: g as any }))}
                            className={`
                                py-3 rounded-xl text-sm font-medium transition-all
                                ${state.gender === g 
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md transform scale-[1.02]' 
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                                }
                                ${lang === 'mm' ? 'font-burmese' : ''}
                            `}
                        >
                            {t(g)}
                        </button>
                    ))}
                </div>
            </div>
            <PrimaryButton 
                onClick={startAnalysis}
                disabled={!state.garmentImage || !state.gender || state.isGenerating}
                className="shadow-xl"
            >
                <div className="flex items-center justify-center gap-2">
                    {state.isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('analyzePlan')}</span>
                </div>
            </PrimaryButton>
        </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-zinc-950">
        <div className="md:hidden px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                <button 
                    onClick={() => setState(prev => ({...prev, step2Tab: 'chat'}))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                        state.step2Tab === 'chat' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                    } ${lang === 'mm' ? 'font-burmese' : ''}`}
                >
                    <MessageSquare size={14} />
                    {t('tabChat')}
                </button>
                <button 
                    onClick={() => setState(prev => ({...prev, step2Tab: 'expert'}))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                        state.step2Tab === 'expert' ? 'bg-white dark:bg-zinc-800 shadow-sm text-pink-600 dark:text-pink-400' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                    } ${lang === 'mm' ? 'font-burmese' : ''}`}
                >
                    <Search size={14} />
                    {t('tabExpert')}
                </button>
            </div>
        </div>
        <div className="flex-1 flex relative overflow-hidden">
            <div className={`
                absolute inset-0 md:static md:inset-auto md:flex-1 
                flex flex-col transition-transform duration-300 
                bg-white dark:bg-zinc-950
                ${state.step2Tab === 'chat' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                 <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-4 md:p-6 space-y-6">
                    {state.chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-sm' 
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
                            }`}>
                                <div className={lang === 'mm' ? 'font-burmese' : ''} style={{whiteSpace: 'pre-wrap'}}>
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                 </div>
                 <div className="p-4 md:p-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                    <input 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder={t('typeMessage')}
                        className={InputStyles}
                    />
                    <button onClick={sendChatMessage} className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        <Send size={20} />
                    </button>
                </div>
            </div>
            <div className={`
                absolute inset-0 md:static md:inset-auto md:w-[400px] lg:w-[450px]
                flex flex-col border-l border-zinc-200 dark:border-zinc-800 
                bg-zinc-50 dark:bg-zinc-900/50 
                transition-transform duration-300
                ${state.step2Tab === 'expert' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            `}>
                <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden">
                    {state.pinterestKeywords.length === 0 ? (
                        <div className="text-center space-y-6 max-w-xs mx-auto animate-fade-in">
                            <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto text-pink-500">
                                <Search size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className={`font-bold text-lg ${lang === 'mm' ? 'font-burmese' : ''}`}>
                                    {t('pinterestExpert')}
                                </h3>
                                <p className={`text-sm text-zinc-500 leading-relaxed ${lang === 'mm' ? 'font-burmese' : ''}`}>
                                    {t('expertIntro')}
                                </p>
                            </div>
                            <PrimaryButton onClick={generateKeywords} disabled={state.isGenerating}>
                                <div className="flex items-center justify-center gap-2">
                                    {state.isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                    <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('generateKeywords')}</span>
                                </div>
                            </PrimaryButton>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col h-full animate-slide-up">
                            <div className="flex-1 overflow-y-auto mb-4 no-scrollbar">
                                <h3 className={`text-xs font-bold uppercase text-zinc-400 mb-4 tracking-wider text-center ${lang === 'mm' ? 'font-burmese' : ''}`}>
                                    {t('pinterestExpert')}
                                </h3>
                                <div className="space-y-3">
                                    {state.pinterestKeywords.map((k, i) => (
                                        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm group">
                                            <div className="flex flex-col gap-1 flex-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                                  {KEYWORD_LABELS[lang][i]}
                                                </span>
                                                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{k}</span>
                                            </div>
                                            <div className="flex items-center gap-1 ml-2">
                                                <button 
                                                    onClick={() => handleSingleRegenerate(i)}
                                                    disabled={state.loadingKeywordIndex === i}
                                                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    <RefreshCcw size={16} className={state.loadingKeywordIndex === i ? 'animate-spin' : ''} />
                                                </button>
                                                <button 
                                                    onClick={() => {navigator.clipboard.writeText(k)}}
                                                    className="p-2 text-zinc-400 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <PrimaryButton onClick={handleNextStep}>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('havePhotos')}</span>
                                        <ChevronRight size={18} />
                                    </div>
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex-1 flex flex-col p-5 gap-6 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-5 h-5 text-zinc-400" />
                <h3 className={`text-base font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('specifications')}</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Garment (Always present context) */}
                <div className="col-span-2 md:col-span-1 row-span-2 aspect-[3/4] md:aspect-auto md:h-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative group">
                    <img src={state.garmentImage || ''} className="w-full h-full object-cover" alt="Garment" />
                     <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-bold uppercase text-white tracking-wide">
                        Main Garment
                    </div>
                </div>

                {/* 2. The 8 Specification Upload Slots */}
                {KEYWORD_LABELS[lang].map((label, i) => (
                    <div key={i} className="aspect-square md:aspect-[4/5]">
                        <FileUpload 
                            label={label}
                            image={state.keywordImages[i]}
                            onImageChange={(img) => handleKeywordImageChange(i, img)}
                            hint={state.pinterestKeywords[i]} // Show AI keyword as hint
                            minimal
                            className="h-full"
                        />
                    </div>
                ))}
            </div>

            {/* Section 3: Additional Accessories/Notes */}
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-400" />
                        <h3 className={`text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('stylingStrategy')}</h3>
                    </div>
                    {state.chatHistory.length > 0 && (
                        <button 
                            onClick={handleImportChat}
                            disabled={state.isGenerating}
                            className={`flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-3 py-1.5 rounded-full hover:bg-zinc-200 transition-colors font-semibold uppercase tracking-wide ${state.isGenerating ? 'opacity-50' : ''}`}
                        >
                            {state.isGenerating ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownToLine size={12} />}
                            <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('importChat')}</span>
                        </button>
                    )}
                </div>
                <textarea 
                    value={state.accessories}
                    onChange={(e) => setState(prev => ({...prev, accessories: e.target.value}))}
                    placeholder={t('accessoriesPlaceholder')}
                    className={`${InputStyles} h-32 resize-none leading-relaxed`}
                />
            </div>

            <div className="mt-4 pb-4">
                <PrimaryButton onClick={generateFinalImage} disabled={state.isGenerating}>
                    <div className="flex items-center justify-center gap-2">
                        {state.isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                        <span className={lang === 'mm' ? 'font-burmese' : ''}>{t('startShoot')}</span>
                    </div>
                </PrimaryButton>
            </div>
        </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 overflow-y-auto w-full max-w-7xl mx-auto h-full items-start">
        <div className="w-full md:flex-1 aspect-[3/4] md:aspect-auto md:h-full max-h-[85vh] bg-zinc-100 dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm relative group border border-zinc-200 dark:border-zinc-800">
            {state.finalImage ? (
                <>
                  <img src={state.finalImage} className="w-full h-full object-contain md:object-cover" alt="Final Result" />
                  <a 
                    href={state.finalImage} 
                    download="burmese-studio-shoot.jpg"
                    className="absolute bottom-6 right-6 bg-white/90 backdrop-blur text-zinc-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform"
                  >
                    Download
                  </a>
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-zinc-500" />
                    <span className={`text-sm font-medium ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('developing')}</span>
                </div>
            )}
        </div>
        <div className="w-full md:w-96 flex-shrink-0 space-y-6">
            {state.masterPrompt && (
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide text-zinc-500 ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('masterPrompt')}</span>
                        <button onClick={copyToClipboard} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono leading-relaxed max-h-48 md:max-h-[50vh] overflow-y-auto">
                        {state.masterPrompt}
                    </p>
                </div>
            )}
            <SecondaryButton onClick={() => setState(prev => ({...prev, step: 1, garmentImage: null, gender: null, finalImage: null, chatHistory: []}))}>
                New Shoot
            </SecondaryButton>
        </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col w-full mx-auto md:h-screen md:overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 ${lang === 'mm' ? 'font-burmese' : 'font-sans'}`}>
        <div className="flex-1 flex flex-col md:max-w-[1400px] md:mx-auto md:w-full md:h-[95vh] md:my-auto md:rounded-2xl md:border md:border-zinc-200 md:dark:border-zinc-800 md:shadow-2xl md:overflow-hidden bg-white dark:bg-zinc-950">
            {renderToast()}
            {renderHeader()}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {state.isSettingsOpen ? renderSettings() : (
                    <>
                        {state.step === 1 && renderStep1()}
                        {state.step === 2 && renderStep2()}
                        {state.step === 3 && renderStep3()}
                        {state.step === 4 && renderStep4()}
                    </>
                )}
            </main>
        </div>
    </div>
  );
}

export default App;