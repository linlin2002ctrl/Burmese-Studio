
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, Moon, Send, Sparkles, ChevronRight, Copy, Check, Loader2, Camera, X, AlertCircle, ArrowDownToLine, FileText, Settings, Search, RefreshCcw, MessageSquare, ListChecks, Key, ExternalLink, Globe, ShieldCheck, Zap, Lock, HelpCircle
} from 'lucide-react';
import { AppState, Message, Language, Step } from './types';
import { TRANSLATIONS, KEYWORD_LABELS } from './constants';
import * as GeminiService from './services/gemini';
import FileUpload from './components/FileUpload';
import { GoogleGenAI } from "@google/genai";

const SG_PROXY_URL = "https://sg-gateway.burmese-studio.ai/v1beta";
const DEMO_KEY = "AIzaSyB0EKDp_jRop2EF9nYtkPdTpAWYg5TKnsM";

const stripBase64 = (dataUrl: string | null) => {
  if (!dataUrl) return null;
  return dataUrl.split(',')[1];
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<Language>('en');

  const [state, setState] = useState<AppState>(() => {
    const savedProxy = localStorage.getItem('burmese_studio_proxy') || '';
    const savedKey = localStorage.getItem('burmese_studio_api_key') || '';
    return {
      step: 1,
      apiKey: savedKey,
      proxyUrl: savedProxy,
      garmentImage: null,
      gender: null,
      step2Tab: 'chat',
      chatHistory: [],
      pinterestKeywords: [],
      keywordImages: new Array(8).fill(null),
      poseRef: null,
      faceRef: null,
      bgRef: null,
      accessories: '',
      finalImage: null,
      isGenerating: false,
      masterPrompt: '',
      error: null,
      isSettingsOpen: false,
      loadingKeywordIndex: null
    };
  });
  
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory, state.step2Tab]);

  const t = (key: string) => TRANSLATIONS[key] ? TRANSLATIONS[key][lang] : key;

  const toggleSingaporeProxy = () => {
    const newUrl = state.proxyUrl === SG_PROXY_URL ? "" : SG_PROXY_URL;
    setState(prev => ({ ...prev, proxyUrl: newUrl }));
  };

  const setDemoKey = () => {
    setState(prev => ({ ...prev, apiKey: DEMO_KEY }));
  };

  const handleError = (e: any) => {
    const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
    setState(prev => ({ ...prev, isGenerating: false, error: msg }));
    setTimeout(() => setState(prev => ({ ...prev, error: null })), 8000);
  };

  const saveSettings = () => {
    localStorage.setItem('burmese_studio_proxy', state.proxyUrl);
    localStorage.setItem('burmese_studio_api_key', state.apiKey);
    setState(prev => ({ ...prev, isSettingsOpen: false }));
  };

  const startAnalysis = async () => {
    if (!state.garmentImage || !state.gender) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
      const response = await GeminiService.analyzeGarment(
        state.apiKey,
        stripBase64(state.garmentImage)!, 
        lang,
        state.gender,
        state.proxyUrl
      );
      setState(prev => ({
        ...prev,
        step: 2,
        step2Tab: 'chat',
        isGenerating: false,
        chatHistory: [{ role: 'model', text: response || "Ready." }]
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: Message = { role: 'user', text: chatInput };
    setState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, userMsg] }));
    setChatInput('');
    
    try {
        const ai = new GoogleGenAI({ 
          apiKey: state.apiKey || process.env.API_KEY || "",
          // @ts-ignore
          baseUrl: state.proxyUrl || undefined
        });
        const chat = ai.chats.create({
            model: "gemini-3-flash-preview",
            history: state.chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            config: {
                systemInstruction: lang === 'mm' ? "Respond in Burmese. You are a fashion producer." : "Respond in English. You are a fashion producer."
            }
        });
        const result = await chat.sendMessage({ message: userMsg.text });
        setState(prev => ({ ...prev, chatHistory: [...prev.chatHistory, userMsg, { role: 'model', text: result.text }] }));
    } catch (e: any) {
        handleError(e);
    }
  };

  const generateKeywords = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
        const keywords = await GeminiService.generateKeywords(state.apiKey, state.chatHistory, lang, state.proxyUrl);
        setState(prev => ({ ...prev, pinterestKeywords: keywords, isGenerating: false }));
    } catch (e) {
        handleError(e);
    }
  };

  const handleSingleRegenerate = async (index: number) => {
    setState(prev => ({ ...prev, loadingKeywordIndex: index, error: null }));
    try {
        const newKeyword = await GeminiService.regenerateSingleKeyword(
            state.apiKey,
            state.chatHistory, 
            KEYWORD_LABELS['en'][index], 
            state.pinterestKeywords[index],
            state.proxyUrl
        );
        setState(prev => {
            const newKeywords = [...prev.pinterestKeywords];
            newKeywords[index] = newKeyword;
            return { ...prev, pinterestKeywords: newKeywords, loadingKeywordIndex: null };
        });
    } catch (e) {
        handleError(e);
        setState(prev => ({ ...prev, loadingKeywordIndex: null }));
    }
  };

  const generateFinalImage = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
        const chatContext = state.chatHistory.map(m => `${m.role}: ${m.text}`).join('\n');
        const result = await GeminiService.generateFashionImage(
            state.apiKey,
            stripBase64(state.garmentImage)!,
            state.keywordImages.map(img => stripBase64(img)),
            state.accessories,
            state.pinterestKeywords,
            chatContext,
            state.proxyUrl
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

  const handleImportChat = async () => {
    if (state.chatHistory.length === 0) return;
    setState(prev => ({ ...prev, isGenerating: true }));
    try {
        const summary = await GeminiService.summarizeChat(state.apiKey, state.chatHistory, lang, state.proxyUrl);
        setState(prev => ({ 
            ...prev, 
            accessories: (prev.accessories ? prev.accessories + '\n\n' : '') + "--- Final Plan ---\n" + summary,
            isGenerating: false 
        }));
    } catch (e) {
        handleError(e);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col w-full mx-auto md:h-screen md:overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 ${lang === 'mm' ? 'font-burmese' : 'font-sans'}`}>
        {/* Settings Overlay */}
        {state.isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setState(prev => ({...prev, isSettingsOpen: false}))} />
            <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 h-full shadow-2xl animate-slide-in-right p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-xl font-bold">{t('settings')}</h2>
                </div>
                <button onClick={() => setState(prev => ({...prev, isSettingsOpen: false}))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8 flex-1">
                {/* API Key Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-500">
                        <Key size={18} />
                        <h3 className="font-bold uppercase text-xs tracking-widest">{t('apiSettings')}</h3>
                    </div>
                    <button onClick={() => setShowGuide(!showGuide)} className="flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-500 hover:text-brand-500 transition-colors">
                        <HelpCircle size={12} /> {showGuide ? 'Hide Guide' : 'Get Key?'}
                    </button>
                  </div>
                  
                  {/* API Key Guide */}
                  {showGuide && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl text-xs space-y-2 border border-zinc-100 dark:border-zinc-800 animate-fade-in">
                        <h4 className="font-bold mb-1">{t('apiKeyGuideTitle')}</h4>
                        <p>{t('guideStep1')}</p>
                        <p>{t('guideStep2')}</p>
                        <p>{t('guideStep3')}</p>
                        <p>{t('guideStep4')}</p>
                        <div className="pt-2 flex gap-2">
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="flex-1 bg-brand-500 text-white text-center py-2 rounded-lg font-bold hover:bg-brand-600 transition-colors flex items-center justify-center gap-1">
                                {t('getYourKey')} <ExternalLink size={10} />
                            </a>
                            <button onClick={setDemoKey} className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white text-center py-2 rounded-lg font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
                                {t('useDemoKey')}
                            </button>
                        </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold block">{t('apiKeyLabel')}</label>
                    <div className="relative">
                        <input 
                        value={state.apiKey} 
                        onChange={(e) => setState(prev => ({...prev, apiKey: e.target.value}))}
                        placeholder={t('apiKeyPlaceholder')}
                        type="password"
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all pr-10"
                        />
                        <Lock size={14} className="absolute right-3 top-3.5 text-zinc-400" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {t('apiKeyHint')}
                    </p>
                  </div>
                </div>

                {/* Network Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-brand-500">
                    <Globe size={18} />
                    <h3 className="font-bold uppercase text-xs tracking-widest">{t('networkSettings')}</h3>
                  </div>
                  
                  <button 
                    onClick={toggleSingaporeProxy}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${state.proxyUrl === SG_PROXY_URL ? 'bg-green-500/5 border-green-500/30 ring-1 ring-green-500/30' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}
                  >
                    <div className="flex flex-col items-start text-left">
                        <span className="text-sm font-bold">{t('singaporeProxy')}</span>
                        <span className="text-[10px] text-zinc-400">Low latency gateway for Myanmar</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${state.proxyUrl === SG_PROXY_URL ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${state.proxyUrl === SG_PROXY_URL ? 'left-5' : 'left-1'}`} />
                    </div>
                  </button>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold block">{t('proxyUrl')}</label>
                    <input 
                      value={state.proxyUrl} 
                      onChange={(e) => setState(prev => ({...prev, proxyUrl: e.target.value}))}
                      placeholder={t('proxyPlaceholder')}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                    <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                      {t('proxyHint')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{t('connectivityStatus')}</span>
                    {state.proxyUrl ? (
                      <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
                         <ShieldCheck size={10} /> {t('proxyMode')}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-zinc-500/10 text-zinc-500 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
                         {t('standardMode')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <button 
                  onClick={saveSettings}
                  className="w-full bg-zinc-900 text-white dark:bg-white dark:text-black py-4 rounded-full font-bold shadow-lg hover:scale-[1.02] transition-transform"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col md:max-w-[1400px] md:mx-auto md:w-full md:h-[95vh] md:my-auto md:rounded-2xl md:border md:border-zinc-200 md:dark:border-zinc-800 md:shadow-2xl md:overflow-hidden bg-white dark:bg-zinc-950">
            {state.error && (
                <div className="fixed top-24 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm z-[60] animate-bounce-in">
                    <div className="bg-red-600/95 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium flex-1">{state.error}</p>
                        <button onClick={() => setState(prev => ({...prev, error: null}))} className="p-1 hover:bg-white/20 rounded-full"><X size={16} /></button>
                    </div>
                </div>
            )}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-500" />
                <h1 className={`font-bold text-lg tracking-tight ${lang === 'mm' ? 'font-burmese' : 'font-sans'}`}>{t('appTitle')}</h1>
                {state.proxyUrl && <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-2" title="Proxy Active" />}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setState(prev => ({...prev, isSettingsOpen: true}))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">
                    <Settings size={18} />
                </button>
                <button onClick={() => setLang(l => l === 'en' ? 'mm' : 'en')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 font-bold text-[10px]">{lang.toUpperCase()}</button>
                <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>
            </header>
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {state.step === 1 && (
                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 md:gap-16 max-w-5xl mx-auto w-full h-full">
                        <div className="w-full max-w-sm md:max-w-md aspect-[3/4] md:h-[500px]">
                            <FileUpload label={t('uploadGarment')} image={state.garmentImage} onImageChange={(img) => setState(prev => ({ ...prev, garmentImage: img }))} aspect="portrait" className="w-full h-full shadow-lg rounded-2xl" />
                        </div>
                        <div className="w-full max-w-sm space-y-8">
                            <div className="space-y-4 text-center md:text-left">
                                <h2 className={`text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 ${lang === 'mm' ? 'font-burmese' : ''}`}>{t('uploadGarment')}</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">Our AI Director will analyze your garment and build a production plan.</p>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                    {['male', 'female', 'unisex'].map((g) => (
                                        <button key={g} onClick={() => setState(prev => ({ ...prev, gender: g as any }))} className={`py-3 rounded-xl text-sm font-medium transition-all ${state.gender === g ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                            {t(g)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={startAnalysis} disabled={!state.garmentImage || !state.gender || state.isGenerating} className="w-full rounded-full px-6 py-4 font-bold flex items-center justify-center gap-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 transition-all hover:shadow-lg">
                                {state.isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                <span>{t('analyzePlan')}</span>
                            </button>
                        </div>
                    </div>
                )}
                {state.step === 2 && (
                    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-zinc-950">
                        <div className="md:hidden px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                                <button onClick={() => setState(prev => ({...prev, step2Tab: 'chat'}))} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${state.step2Tab === 'chat' ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-500'}`}>{t('tabChat')}</button>
                                <button onClick={() => setState(prev => ({...prev, step2Tab: 'expert'}))} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${state.step2Tab === 'expert' ? 'bg-white dark:bg-zinc-800 shadow-sm text-brand-500' : 'text-zinc-500'}`}>{t('tabExpert')}</button>
                            </div>
                        </div>
                        <div className="flex-1 flex relative overflow-hidden">
                            <div className={`absolute inset-0 md:static md:flex-1 flex flex-col transition-transform duration-300 bg-white dark:bg-zinc-950 ${state.step2Tab === 'chat' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                                <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-4 md:p-6 space-y-6">
                                    {state.chatHistory.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[90%] md:max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'}`}>
                                                <div style={{whiteSpace: 'pre-wrap'}}>{msg.text}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {state.isGenerating && (
                                        <div className="flex justify-start">
                                            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl rounded-bl-sm">
                                                <Loader2 size={18} className="animate-spin text-zinc-400" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 md:p-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} placeholder={t('typeMessage')} className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-brand-500/30" />
                                    <button onClick={sendChatMessage} className="p-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg"><Send size={20} /></button>
                                </div>
                            </div>
                            <div className={`absolute inset-0 md:static md:w-[400px] flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 transition-transform duration-300 ${state.step2Tab === 'expert' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                                <div className="flex-1 p-6 flex flex-col items-center justify-center">
                                    {state.pinterestKeywords.length === 0 ? (
                                        <div className="text-center space-y-6 animate-fade-in">
                                            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto text-brand-500"><Search size={32} /></div>
                                            <div className="space-y-2">
                                                <h3 className="font-bold text-lg">{t('pinterestExpert')}</h3>
                                                <p className="text-sm text-zinc-500 leading-relaxed">{t('expertIntro')}</p>
                                            </div>
                                            <button onClick={generateKeywords} disabled={state.isGenerating} className="w-full py-4 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold flex items-center justify-center gap-2">
                                                {state.isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                                <span>{t('generateKeywords')}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full flex flex-col h-full">
                                            <div className="flex-1 overflow-y-auto mb-4 no-scrollbar space-y-3">
                                                {state.pinterestKeywords.map((k, i) => (
                                                    <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{KEYWORD_LABELS[lang][i]}</span>
                                                            <span className="text-sm font-medium">{k}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => handleSingleRegenerate(i)} disabled={state.loadingKeywordIndex === i} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg"><RefreshCcw size={16} className={state.loadingKeywordIndex === i ? 'animate-spin' : ''} /></button>
                                                            <button onClick={() => navigator.clipboard.writeText(k)} className="p-2 text-zinc-400 hover:text-brand-500 rounded-lg"><Copy size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={() => setState(prev => ({...prev, step: 3}))} className="w-full py-4 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold flex items-center justify-center gap-2">
                                                <span>{t('havePhotos')}</span>
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {state.step === 3 && (
                    <div className="flex-1 flex flex-col p-5 gap-6 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/20">
                        <div className="w-full max-w-6xl mx-auto space-y-6">
                            <div className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-zinc-400" /><h3 className="text-base font-bold uppercase tracking-wider">{t('specifications')}</h3></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-2 md:col-span-1 row-span-2 aspect-[3/4] md:aspect-auto md:h-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative">
                                    <img src={state.garmentImage || ''} className="w-full h-full object-cover" alt="Garment" />
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-bold uppercase text-white tracking-wide">Main Garment</div>
                                </div>
                                {KEYWORD_LABELS[lang].map((label, i) => (
                                    <div key={i} className="aspect-square md:aspect-[4/5]">
                                        <FileUpload label={label} image={state.keywordImages[i]} onImageChange={(img) => setState(prev => { const newImg = [...prev.keywordImages]; newImg[i] = img; return {...prev, keywordImages: newImg}; })} hint={state.pinterestKeywords[i]} minimal className="h-full" />
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-zinc-400" /><h3 className="text-sm font-bold uppercase tracking-wider">{t('stylingStrategy')}</h3></div>
                                    <button onClick={handleImportChat} className="flex items-center gap-1 text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-3 py-1.5 rounded-full hover:bg-zinc-200 transition-colors font-semibold uppercase tracking-wide">
                                        <ArrowDownToLine size={12} /><span>{t('importChat')}</span>
                                    </button>
                                </div>
                                <textarea value={state.accessories} onChange={(e) => setState(prev => ({...prev, accessories: e.target.value}))} placeholder={t('accessoriesPlaceholder')} className="w-full bg-transparent border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 text-sm h-32 resize-none leading-relaxed outline-none" />
                            </div>
                            <button onClick={generateFinalImage} disabled={state.isGenerating} className="w-full py-4 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                                {state.isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                                <span>{t('startShoot')}</span>
                            </button>
                        </div>
                    </div>
                )}
                {state.step === 4 && (
                    <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 overflow-y-auto w-full max-w-7xl mx-auto h-full items-start">
                        <div className="w-full md:flex-1 aspect-[3/4] md:h-full bg-zinc-100 dark:bg-zinc-900 rounded-2xl overflow-hidden relative border border-zinc-200 dark:border-zinc-800">
                            {state.finalImage ? (
                                <>
                                    <img src={state.finalImage} className="w-full h-full object-contain md:object-cover" alt="Result" />
                                    <a href={state.finalImage} download="burmese-studio.jpg" className="absolute bottom-6 right-6 bg-white/90 backdrop-blur text-black px-6 py-2 rounded-full text-sm font-bold shadow-lg">Download</a>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                    <span className="text-sm font-medium">{t('developing')}</span>
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-96 flex-shrink-0 space-y-6">
                            {state.masterPrompt && (
                                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t('masterPrompt')}</span>
                                        <button onClick={() => { navigator.clipboard.writeText(state.masterPrompt); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                                            {copied ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-xs font-mono leading-relaxed max-h-48 overflow-y-auto">{state.masterPrompt}</p>
                                </div>
                            )}
                            <button onClick={() => setState(prev => ({...prev, step: 1, garmentImage: null, gender: null, finalImage: null, chatHistory: [], pinterestKeywords: [], keywordImages: new Array(8).fill(null)}))} className="w-full py-4 rounded-full border border-zinc-200 dark:border-zinc-800 font-bold hover:bg-zinc-50 transition-colors">New Shoot</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    </div>
  );
}

export default App;
