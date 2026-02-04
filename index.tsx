
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Send, 
  Image as ImageIcon, 
  MessageSquare, 
  Volume2, 
  Settings, 
  Sparkles, 
  Search, 
  Trash2, 
  Loader2,
  Globe,
  Mic,
  Plus,
  Download,
  Zap,
  Cpu,
  Film,
  Link2
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types ---
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | 'error';
  imageUrl?: string;
  videoUrl?: string;
  groundingLinks?: Array<{ title: string; uri: string }>;
  timestamp: Date;
  isAuthError?: boolean;
};

type AppMode = 'chat' | 'image' | 'video';

// --- Utilities ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// --- Components ---

const EYSMOTH = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'EYSMOTH Neural Core Online. Neural chat, Image synthesis, and Motion studio are ready. If you encounter permission issues with Video, please use the Link Engine tool.',
      type: 'text',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [useSearch, setUseSearch] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const videoFeedback = [
    "Establishing secure neural link...",
    "Synthesizing motion vectors...",
    "Rendering cinematic sequence...",
    "Optimizing high-fidelity output...",
    "Finalizing video artifact..."
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, videoStatus]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const handleLinkEngine = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // After linking, we refresh the state to let the user try again
      return true;
    }
    return false;
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      type: 'text',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Create fresh instance to ensure we use the latest linked key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      if (appMode === 'chat') {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: currentInput,
          config: {
            tools: useSearch ? [{ googleSearch: {} }] : undefined,
          },
        });

        const text = response.text || "Transmission interrupted. Please retry.";
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const links = grounding?.map(chunk => ({
          title: chunk.web?.title || 'Source',
          uri: chunk.web?.uri || '#'
        })).filter(l => l.uri !== '#');

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: text,
          type: 'text',
          groundingLinks: links,
          timestamp: new Date(),
        }]);
      } 
      else if (appMode === 'image') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: currentInput }] },
          config: {
            imageConfig: { aspectRatio: "1:1" }
          },
        });

        let imageUrl = '';
        let assistantText = 'Visual synthesis complete.';

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          } else if (part.text) {
            assistantText = part.text;
          }
        }

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantText,
          type: 'image',
          imageUrl: imageUrl,
          timestamp: new Date(),
        }]);
      }
      else if (appMode === 'video') {
        setVideoStatus(videoFeedback[0]);
        let feedbackIdx = 0;
        const feedbackTimer = setInterval(() => {
          feedbackIdx = (feedbackIdx + 1) % videoFeedback.length;
          setVideoStatus(videoFeedback[feedbackIdx]);
        }, 8000);

        try {
          const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          let operation = await videoAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: currentInput,
            config: {
              numberOfVideos: 1,
              resolution: '1080p',
              aspectRatio: '16:9'
            }
          });

          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 8000));
            operation = await videoAi.operations.getVideosOperation({ operation: operation });
          }

          const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
          const videoBlob = await videoResponse.blob();
          const videoUrl = URL.createObjectURL(videoBlob);

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "Motion synthesis complete. Artifact available for export.",
            type: 'video',
            videoUrl: videoUrl,
            timestamp: new Date(),
          }]);
        } finally {
          clearInterval(feedbackTimer);
          setVideoStatus('');
        }
      }
    } catch (error: any) {
      console.error("EYSMOTH Error:", error);
      const errText = error.message || "";
      const isAuthError = errText.includes("PERMISSION_DENIED") || 
                         errText.includes("403") || 
                         errText.includes("not found");

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isAuthError 
          ? "Permission Denied: Video generation requires a linked Video Engine. This is a technical requirement for high-fidelity motion processing." 
          : `System Alert: ${error.message || 'Operation failed. Network error.'}`,
        type: 'error',
        isAuthError: isAuthError,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleTTS = async (text: string, messageId: string) => {
    if (audioPlaying === messageId) return;
    
    setAudioPlaying(messageId);
    try {
      const ctx = initAudio();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setAudioPlaying(null);
        source.start();
      } else {
        setAudioPlaying(null);
      }
    } catch (err) {
      console.error("Vocalization failed", err);
      setAudioPlaying(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#020202] text-teal-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 border-r border-teal-500/10 flex flex-col bg-[#050505] z-30">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white leading-none">EYSMOTH</span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-teal-500/80 mt-1 leading-none uppercase">BY: DANIEL ROJO</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-2 py-6">
          <button 
            onClick={() => setAppMode('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appMode === 'chat' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="hidden md:block font-bold text-sm">Neural Chat</span>
          </button>
          
          <button 
            onClick={() => setAppMode('image')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appMode === 'image' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="hidden md:block font-bold text-sm">Visual Lab</span>
          </button>

          <button 
            onClick={() => setAppMode('video')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appMode === 'video' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Film className="w-5 h-5" />
            <span className="hidden md:block font-bold text-sm">Motion Studio</span>
          </button>

          <div className="pt-8 px-4 border-t border-teal-500/5 mt-4">
            <p className="text-[10px] uppercase tracking-widest text-teal-900 font-black mb-4 hidden md:block">Active Tools</p>
            <button 
              onClick={() => setUseSearch(!useSearch)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${useSearch ? 'text-cyan-400 bg-cyan-500/5' : 'text-gray-500 hover:bg-white/5'}`}
            >
              <Globe className={`w-5 h-5 ${useSearch ? 'animate-pulse' : ''}`} />
              <span className="hidden md:block font-bold text-sm">Web Search</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-teal-500/10">
          <button 
            onClick={handleLinkEngine}
            className="w-full flex items-center gap-3 px-4 py-3 text-teal-500/50 hover:text-teal-400 transition-colors text-[10px] font-black uppercase tracking-widest group"
          >
            <Link2 className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            <span className="hidden md:block">Link Video Engine</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-teal-950/20 via-black to-black">
        <header className="h-16 border-b border-teal-500/10 flex items-center px-8 justify-between backdrop-blur-xl bg-black/60 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.3em]">
              {appMode === 'chat' ? 'Neural Link' : appMode === 'image' ? 'Visual Core' : 'Motion Core'}
            </h2>
            <div className="w-px h-3 bg-teal-500/20" />
            <span className="text-xs font-bold text-teal-100/50">EYSMOTH Studio</span>
          </div>
          <button 
            onClick={() => setMessages([])}
            className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-gray-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-12 space-y-10 scroll-smooth custom-scrollbar"
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} max-w-4xl mx-auto items-start`}
            >
              <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center ${msg.role === 'assistant' ? 'bg-teal-600 shadow-lg shadow-teal-500/20' : 'bg-white/5 border border-white/10'}`}>
                {msg.role === 'assistant' ? <Cpu className="w-5 h-5 text-white" /> : <div className="text-[10px] font-black text-gray-400">YOU</div>}
              </div>
              <div className={`flex flex-col gap-3 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                <div 
                  className={`p-6 rounded-3xl text-sm md:text-base leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/10' 
                      : msg.type === 'error' 
                        ? 'bg-red-500/5 border border-red-500/20 text-red-300' 
                        : 'bg-[#0a0a0a] border border-teal-500/10 text-teal-50'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.isAuthError && (
                    <button 
                      onClick={handleLinkEngine}
                      className="mt-6 flex items-center gap-2 bg-red-500/20 text-red-300 border border-red-500/30 px-6 py-3 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    >
                      <Link2 className="w-4 h-4" /> Fix Permission: Link Engine
                    </button>
                  )}

                  {msg.type === 'image' && msg.imageUrl && (
                    <div className="mt-6 overflow-hidden rounded-2xl border border-teal-500/20 bg-black/40 group relative">
                      <img src={msg.imageUrl} alt="Generated Artifact" className="w-full h-auto transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <a href={msg.imageUrl} download="eysmoth-render.png" className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1 hover:text-white transition-colors bg-black/60 px-4 py-2 rounded-full border border-teal-500/20">
                          <Download className="w-3 h-3" /> Save Artifact
                        </a>
                      </div>
                    </div>
                  )}

                  {msg.type === 'video' && msg.videoUrl && (
                    <div className="mt-6 overflow-hidden rounded-2xl border border-teal-500/20 bg-black/40">
                      <video src={msg.videoUrl} controls className="w-full h-auto" />
                      <div className="p-3 flex justify-end">
                        <a href={msg.videoUrl} download="eysmoth-motion.mp4" className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1 hover:text-white transition-colors bg-teal-500/5 px-4 py-2 rounded-full border border-teal-500/10">
                          <Download className="w-3 h-3" /> Export Motion
                        </a>
                      </div>
                    </div>
                  )}

                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-teal-500/10">
                      {msg.groundingLinks.map((link, idx) => (
                        <a 
                          key={idx} 
                          href={link.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] bg-teal-500/5 text-teal-500 px-3 py-1.5 rounded-full border border-teal-500/10 hover:bg-teal-500 hover:text-black transition-all font-black uppercase tracking-wider"
                        >
                          {link.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                
                {msg.role === 'assistant' && msg.type === 'text' && (
                  <button 
                    onClick={() => handleTTS(msg.content, msg.id)}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${audioPlaying === msg.id ? 'text-teal-400' : 'text-gray-700 hover:text-teal-400'}`}
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${audioPlaying === msg.id ? 'animate-bounce' : ''}`} />
                    {audioPlaying === msg.id ? 'Outputting Voice...' : 'Speech Sync'}
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {(isTyping || videoStatus) && (
            <div className="flex gap-6 max-w-4xl mx-auto items-center text-teal-600/50">
              <div className="w-10 h-10 rounded-2xl bg-teal-600/10 border border-teal-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black uppercase tracking-widest">
                  {videoStatus || (appMode === 'image' ? 'Synthesizing Visuals...' : 'Processing Neural Data...')}
                </span>
                <div className="w-48 h-0.5 bg-teal-900/50 rounded-full overflow-hidden relative">
                  <div className="h-full bg-teal-500 animate-[loading_2s_infinite]" style={{width: '40%'}} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 md:p-10 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-teal-500/5 blur-2xl rounded-[3rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
            
            <div className="bg-[#0a0a0a] border border-teal-500/10 rounded-[2.5rem] p-3 flex items-center gap-3 shadow-2xl focus-within:border-teal-500/40 transition-all relative">
              <div className="flex items-center gap-1 pl-3">
                <button className="p-3 text-gray-700 hover:text-teal-400 transition-all"><Mic className="w-5 h-5" /></button>
                <button className="p-3 text-gray-700 hover:text-teal-400 transition-all"><Plus className="w-5 h-5" /></button>
              </div>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  appMode === 'video' ? "Describe cinematic motion sequence..." : 
                  appMode === 'image' ? "Envision a visual artifact..." : 
                  "Command EYSMOTH..."
                }
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base py-3 px-2 resize-none placeholder:text-gray-800 text-teal-50"
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className={`p-4 rounded-full transition-all flex items-center justify-center ${
                  input.trim() && !isTyping ? 'bg-teal-500 text-black active:scale-95 shadow-lg shadow-teal-500/20' : 'bg-white/5 text-gray-800'
                }`}
              >
                {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex flex-col items-center mt-6">
              <p className="text-[10px] text-teal-800 font-black uppercase tracking-[0.4em]">
                EYSMOTH Neural Core • Standard Edition
              </p>
              <p className="text-[8px] text-teal-950 font-bold uppercase tracking-[0.6em] mt-1">
                ENGINEERED BY: DANIEL ROJO
              </p>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(20, 184, 166, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(20, 184, 166, 0.2); }
      `}} />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<EYSMOTH />);
