import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Message, Movie } from "../types";
import { getImageUrl } from "../utils/tmdb";
import { runVisualSearchMatch, buildVisualContextFromResult, VisualContextPayload } from "../utils/visualSearch";
import { askAssistant, stripActionBlocks } from "../utils/assistantClient";
import { Sparkles, Send, ImagePlus, X, Bot, Loader2, Play, MessageSquareText, ShieldCheck } from "lucide-react";

interface HomeAIAssistantProps {
  onSelectMovie: (movie: Movie) => void;
}

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, data] = result.split(",");
      const mimeType = prefix.match(/data:(.*);base64/)?.[1] || file.type || "image/jpeg";
      resolve({ data, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const HOME_QUICK_PROMPTS = [
  "What should I watch tonight?",
  "Surprise me with something underrated",
  "Best movies trending this week?",
];

export const HomeAIAssistant: React.FC<HomeAIAssistantProps> = ({ onSelectMovie }) => {
  const { user } = useApp();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [hasAutoIntroduced, setHasAutoIntroduced] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: `Hey${user ? ` ${user.name}` : ""}! I'm All Kiki's — your Cinemax AI. Ask me anything about the site, get recommendations, or upload a photo for **Visual Search** and I'll find matching titles.${isAdmin ? "\n\nI recognize you as an administrator — ask me about the Admin Panel anytime." : ""}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ previewUrl: string; base64: string; mimeType: string } | null>(null);
  const visualContextRef = useRef<VisualContextPayload | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasAutoIntroduced) return;
    const t = setTimeout(() => setHasAutoIntroduced(true), 4000);
    return () => clearTimeout(t);
  }, [hasAutoIntroduced]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data, mimeType } = await fileToBase64(file);
    setPendingImage({ previewUrl: URL.createObjectURL(file), base64: data, mimeType });
    e.target.value = "";
  };

  const handleSend = async (textOverride?: string) => {
    const prompt = (textOverride ?? input).trim();
    if (!prompt && !pendingImage) return;

    const attachedImage = pendingImage;
    const userMsg: Message = {
      role: "user",
      text: prompt || (attachedImage ? "Find movies that look like this image." : ""),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      imageUrl: attachedImage?.previewUrl,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    try {
      if (attachedImage) {
        const result = await runVisualSearchMatch(attachedImage.base64, attachedImage.mimeType, prompt || undefined);
        const ctx = buildVisualContextFromResult(result);
        visualContextRef.current = ctx;

        let replyText = result.aiAnswer
          ? result.aiAnswer
          : `${result.description}\n\nHere are titles with a similar look and feel:`;

        if (!result.matches.length) {
          replyText = `${result.description}\n\nI couldn't find close matches — try a clearer poster or screenshot, or describe the mood you want.`;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            visualMatches: result.matches,
            visualContext: ctx,
          },
        ]);
      } else {
        const { text } = await askAssistant({
          message: prompt,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          visualContext: visualContextRef.current,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: stripActionBlocks(text) || "Here's what I found!",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: err?.message ? `I couldn't complete that: ${err.message}` : "Sorry — please try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          id="home-ai-launcher"
          onClick={() => setOpen(true)}
          className="fixed right-5 bottom-6 z-50 flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-[#39FF14] text-black shadow-[0_0_25px_rgba(57,255,20,0.55)] border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Ask the Homepage AI Assistant"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-wide hidden sm:inline">Ask AI</span>
          {!hasAutoIntroduced && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-black animate-pulse" />
          )}
        </button>
      )}

      {open && (
        <div
          id="home-ai-panel"
          className="fixed z-50 right-0 sm:right-5 bottom-0 sm:bottom-6 w-full sm:w-[400px] h-[85dvh] sm:h-[580px] max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#39FF14] to-emerald-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-black" />
              </div>
              <div>
                <h3 className="font-sans font-black text-sm text-white leading-none flex items-center gap-2">
                  All Kiki's AI
                  {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-[#39FF14]" title="Admin recognized" />}
                </h3>
                <p className="text-[10px] text-neutral-500 mt-1">Visual Search + full site guide</p>
              </div>
            </div>
            <button id="close-home-ai-btn" onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white cursor-pointer p-1">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-[#39FF14] text-black font-medium" : "bg-white/5 border border-white/10 text-neutral-200"
                  }`}
                >
                  {m.imageUrl && <img src={m.imageUrl} alt="Uploaded" className="rounded-xl mb-2 max-h-32 object-cover" />}
                  {m.text}
                  {m.visualMatches && m.visualMatches.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {m.visualMatches.map((movie) => (
                        <button key={movie.id} onClick={() => onSelectMovie(movie)} className="group relative rounded-lg overflow-hidden aspect-[2/3] cursor-pointer">
                          <img src={getImageUrl(movie.poster_path)} alt={movie.title || movie.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                            <Play className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 fill-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#39FF14]" />
                  <span className="text-[10px] text-neutral-400">{pendingImage ? "Analyzing image..." : "Thinking..."}</span>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {HOME_QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => handleSend(p)} className="flex-shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-[10px] font-semibold px-3 py-2 rounded-xl cursor-pointer">
                  <MessageSquareText className="h-3 w-3 text-[#39FF14]" />
                  {p}
                </button>
              ))}
            </div>
          )}

          {pendingImage && (
            <div className="px-4 pb-2 flex items-center gap-2">
              <img src={pendingImage.previewUrl} alt="Pending" className="h-12 w-12 rounded-lg object-cover border border-white/10" />
              <span className="text-[10px] text-neutral-400 flex-1">Visual Search ready — add a question or tap send</span>
              <button onClick={() => setPendingImage(null)} className="text-neutral-500 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="p-3 border-t border-white/10 flex items-center gap-2 bg-black/40">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
            <button onClick={handlePickImage} disabled={loading} className="flex-shrink-0 h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-[#39FF14] cursor-pointer disabled:opacity-40" title="Visual Search">
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={pendingImage ? "Ask about this image (optional)..." : "Ask anything about Cinemax..."}
              className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-600"
            />
            <button onClick={() => handleSend()} disabled={loading || (!input.trim() && !pendingImage)} className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#39FF14] hover:brightness-110 disabled:opacity-40 flex items-center justify-center text-black cursor-pointer">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
