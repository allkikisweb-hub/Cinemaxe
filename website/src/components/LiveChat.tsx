import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { AvatarRenderer } from "./AnimatedAvatar";
import { ChatMessage, ChatConversation, DirectMessage, ChatDirectoryPerson } from "../types";
import {
  MessageCircle,
  Send,
  Heart,
  Reply,
  X,
  Users,
  Inbox as InboxIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowLeft,
  Loader2,
  PenSquare,
  LogIn,
  ImagePlus,
  Mic,
  Square,
} from "lucide-react";

const POPULAR_POLL_MS = 4000;
const CONVERSATIONS_POLL_MS = 6000;
const THREAD_POLL_MS = 3500;

// Reads a File straight into a base64 data URL — used for the image-attach
// feature on both Popular and Inbox, so bubbles can just <img src={...}>
// with no separate mime-type bookkeeping.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** A small pill shown above the composer previewing a picked image before send. */
const PendingImageStrip: React.FC<{ url: string; onClear: () => void }> = ({ url, onClear }) => (
  <div className="mx-3 mb-2 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5">
    <img src={url} alt="Attachment preview" className="h-10 w-10 rounded-lg object-cover" />
    <span className="text-[10px] text-neutral-400 flex-1">Image ready to send</span>
    <button onClick={onClear} className="text-neutral-500 hover:text-white cursor-pointer p-1">
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);

/** Inline audio player used for voice-note bubbles in the Inbox. */
const VoiceBubble: React.FC<{ src: string }> = ({ src }) => (
  <audio controls src={src} className="w-full max-w-[220px] h-9" />
);

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/**
 * The site's Live Chat — a compact two-tab panel that lives in the player's
 * sidebar, above the "Up Next" queue, and fills the majority of that
 * sidebar's height. "Popular" is one global feed every visitor can read,
 * with threaded replies and likes; "Inbox" is private 1-to-1 messaging
 * between signed-in members. Posting (either tab) requires being signed in;
 * reading Popular does not. Both tabs poll rather than push — simple,
 * dependency-free, and responsive enough at this scale.
 */
interface LiveChatProps {
  /** `home` = taller panel on the home page; `sidebar` = compact player sidebar */
  variant?: "sidebar" | "home";
}

export const LiveChat: React.FC<LiveChatProps> = ({ variant = "sidebar" }) => {
  const { user, isGuest, requireSignInPrompt, t } = useApp();
  const isSignedIn = !!user && !isGuest;
  const isHome = variant === "home";

  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"popular" | "inbox">("popular");
  const [unreadTotal, setUnreadTotal] = useState(0);

  return (
    <div
      id="live-chat-panel"
      className={`solid-card rounded-3xl overflow-hidden border border-white/5 live-chat-panel ${
        isHome ? "live-chat-home" : ""
      } ${collapsed ? "flex-none" : ""}`}
    >
      {/* Header */}
      <button
        id="live-chat-header"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex-none flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-[#39FF14]/10 to-transparent cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-[#39FF14]" />
          <span className="font-sans font-bold text-xs text-white">{t("liveChat")}</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39FF14] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#39FF14]" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          {unreadTotal > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
          )}
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex-none flex border-b border-white/5 bg-black/20">
            <button
              id="live-chat-tab-popular"
              onClick={() => setTab("popular")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors cursor-pointer ${
                tab === "popular" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> {t("popular")}
            </button>
            <button
              id="live-chat-tab-inbox"
              onClick={() => setTab("inbox")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors cursor-pointer relative ${
                tab === "inbox" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent"
              }`}
            >
              <InboxIcon className="h-3.5 w-3.5" /> {t("inbox")}
              {unreadTotal > 0 && <span className="absolute top-1.5 right-[28%] h-1.5 w-1.5 rounded-full bg-rose-500" />}
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {tab === "popular" ? (
              <PopularTab isSignedIn={isSignedIn} myId={user?.id} onSignInRequired={requireSignInPrompt} />
            ) : (
              <InboxTab
                isSignedIn={isSignedIn}
                myId={user?.id}
                onSignInRequired={requireSignInPrompt}
                onUnreadChange={setUnreadTotal}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// POPULAR — global feed, threaded replies, likes
// ---------------------------------------------------------------------------

const PopularTab: React.FC<{ isSignedIn: boolean; myId?: string; onSignInRequired: () => void }> = ({
  isSignedIn,
  myId,
  onSignInRequired,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const prevCountRef = useRef(0);
  const isNearBottomRef = useRef(true);

  const handlePickImage = () => {
    if (!isSignedIn) {
      onSignInRequired();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingImage(dataUrl);
  };

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api("/api/chat/global");
      setMessages(data.messages || []);
    } catch {
      // silent on poll failures — keep showing the last good state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const t = setInterval(fetchMessages, POPULAR_POLL_MS);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => {
    if (!initialLoadDone.current && !loading) {
      initialLoadDone.current = true;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    const count = messages.length;
    if (count > prevCountRef.current && (isNearBottomRef.current || !initialLoadDone.current)) {
      requestAnimationFrame(() => {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: initialLoadDone.current ? "smooth" : "auto",
        });
      });
    }
    prevCountRef.current = count;
  }, [messages, loading]);

  const handleMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  const topLevel = messages.filter((m) => !m.parentId);
  const repliesOf = (id: string) => messages.filter((m) => m.parentId === id);

  const handleSend = async () => {
    if (!isSignedIn) {
      onSignInRequired();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    setSending(true);
    setError("");
    try {
      const data = await api("/api/chat/global", {
        method: "POST",
        body: JSON.stringify({ text: trimmed, parentId: replyTo?.id || null, mediaUrl: pendingImage || undefined }),
      });
      setMessages((prev) => [...prev, data.message]);
      setText("");
      setPendingImage(null);
      setReplyTo(null);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (!isSignedIn) {
      onSignInRequired();
      return;
    }
    // optimistic
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, likedByMe: !m.likedByMe, likeCount: m.likeCount + (m.likedByMe ? -1 : 1) } : m))
    );
    try {
      const data = await api(`/api/chat/global/${id}/like`, { method: "POST" });
      setMessages((prev) => prev.map((m) => (m.id === id ? data.message : m)));
    } catch {
      fetchMessages();
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await api(`/api/chat/global/${id}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== id && m.parentId !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderBubble = (m: ChatMessage, isReply: boolean) => (
    <div key={m.id} id={`chat-msg-${m.id}`} className={`flex gap-2.5 ${isReply ? "ml-8 mt-2" : ""}`}>
      <AvatarRenderer value={m.userAvatar} size={isReply ? 24 : 30} initials={m.userName?.[0]} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-white truncate">{m.userName}</span>
          {m.userId === myId && <span className="text-[9px] text-[#39FF14] font-bold">You</span>}
          <span className="text-[9px] text-neutral-500">{timeAgo(m.createdAt)}</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed break-words mt-0.5">{m.text}</p>
        {m.mediaType === "image" && m.mediaUrl && (
          <img
            src={m.mediaUrl}
            alt="Shared attachment"
            className="mt-2 max-w-[180px] max-h-[180px] rounded-xl border border-white/10 object-cover cursor-pointer"
            onClick={() => window.open(m.mediaUrl!, "_blank")}
          />
        )}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => toggleLike(m.id)}
            className={`flex items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              m.likedByMe ? "text-[#39FF14]" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Heart className={`h-3 w-3 ${m.likedByMe ? "fill-[#39FF14]" : ""}`} />
            {m.likeCount > 0 && m.likeCount}
          </button>
          {!isReply && (
            <button
              onClick={() => (isSignedIn ? setReplyTo(m) : onSignInRequired())}
              className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
          {m.userId === myId && (
            <button
              onClick={() => deleteMessage(m.id)}
              className="flex items-center gap-1 text-[10px] font-semibold text-neutral-600 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        className="live-chat-messages no-scrollbar px-4 py-3 space-y-3.5"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-neutral-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : topLevel.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Users className="h-6 w-6 text-neutral-700" />
            <p className="text-[11px] text-neutral-600">No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          topLevel.map((m) => (
            <div key={m.id}>
              {renderBubble(m, false)}
              {repliesOf(m.id).map((r) => renderBubble(r, true))}
            </div>
          ))
        )}
      </div>

      {error && <div className="px-4 pb-1 text-[10px] text-rose-400 font-semibold">{error}</div>}

      {replyTo && (
        <div className="mx-4 mb-1.5 flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] text-neutral-400 truncate">
            Replying to <span className="text-neutral-200 font-semibold">{replyTo.userName}</span>
          </span>
          <button onClick={() => setReplyTo(null)} className="text-neutral-500 hover:text-white cursor-pointer">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex-none p-3 border-t border-white/5 bg-black/40 live-chat-composer">
        {isSignedIn ? (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
            {pendingImage && <PendingImageStrip url={pendingImage} onClear={() => setPendingImage(null)} />}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePickImage}
                title="Attach an image"
                className="flex-shrink-0 h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-[#39FF14] transition-all cursor-pointer"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && handleSend()}
                placeholder={replyTo ? "Write a reply..." : "Say something to everyone..."}
                maxLength={1000}
                className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={sending || (!text.trim() && !pendingImage)}
                className="flex-shrink-0 h-9 w-9 rounded-xl bg-[#39FF14] hover:brightness-110 disabled:opacity-40 flex items-center justify-center text-black transition-all cursor-pointer"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onSignInRequired}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in to join the conversation
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// INBOX — private 1-to-1 messaging
// ---------------------------------------------------------------------------

const InboxTab: React.FC<{
  isSignedIn: boolean;
  myId?: string;
  onSignInRequired: () => void;
  onUnreadChange: (count: number) => void;
}> = ({ isSignedIn, myId, onSignInRequired, onUnreadChange }) => {
  const [view, setView] = useState<"list" | "thread" | "new">("list");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [directory, setDirectory] = useState<ChatDirectoryPerson[]>([]);
  const [activePartner, setActivePartner] = useState<ChatConversation | ChatDirectoryPerson | null>(null);
  const [thread, setThread] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const data = await api("/api/chat/conversations");
      setConversations(data.conversations || []);
      onUnreadChange((data.conversations || []).reduce((sum: number, c: ChatConversation) => sum + c.unreadCount, 0));
    } catch {
      // silent on poll failures
    } finally {
      setLoadingList(false);
    }
  }, [isSignedIn, onUnreadChange]);

  useEffect(() => {
    if (!isSignedIn) {
      setLoadingList(false);
      return;
    }
    fetchConversations();
    const t = setInterval(fetchConversations, CONVERSATIONS_POLL_MS);
    return () => clearInterval(t);
  }, [isSignedIn, fetchConversations]);

  const fetchThread = useCallback(async (partnerId: string) => {
    try {
      const data = await api(`/api/chat/conversations/${partnerId}`);
      setThread(data.messages || []);
    } catch {
      // silent on poll failures
    }
  }, []);

  useEffect(() => {
    if (view !== "thread" || !activePartner) return;
    fetchThread(activePartner.userId ? activePartner.userId : (activePartner as ChatDirectoryPerson).id);
    const partnerId = "userId" in activePartner ? activePartner.userId : activePartner.id;
    const t = setInterval(() => fetchThread(partnerId), THREAD_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activePartner, fetchThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const openDirectory = async () => {
    try {
      const data = await api("/api/chat/directory");
      setDirectory(data.people || []);
      setView("new");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openThread = (partner: ChatConversation | ChatDirectoryPerson) => {
    setActivePartner(partner);
    setThread([]);
    setView("thread");
    setError("");
  };

  const partnerId = activePartner ? ("userId" in activePartner ? activePartner.userId : activePartner.id) : "";
  const partnerName = activePartner ? ("userName" in activePartner ? activePartner.userName : activePartner.name) : "";
  const partnerAvatar = activePartner ? ("userAvatar" in activePartner ? activePartner.userAvatar : activePartner.avatar) : "";

  const handleSend = async (mediaUrl?: string, mediaType?: "image" | "audio") => {
    const trimmed = text.trim();
    if (!trimmed && !mediaUrl) return;
    if (!partnerId) return;
    setSending(true);
    setError("");
    try {
      const data = await api(`/api/chat/conversations/${partnerId}`, {
        method: "POST",
        body: JSON.stringify({ text: trimmed, mediaUrl, mediaType }),
      });
      setThread((prev) => [...prev, data.message]);
      setText("");
      setPendingImage(null);
      fetchConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPendingImage(dataUrl);
  };

  // Voice notes — recorded with MediaRecorder and sent as an inbox-only
  // attachment the instant recording stops (no text needed alongside it).
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setIsRecording(false);
        setRecordSeconds(0);
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const dataUrl = await blobToDataUrl(blob);
          handleSend(dataUrl, "audio");
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access your microphone. Check your browser permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const toggleLike = async (id: string) => {
    setThread((prev) =>
      prev.map((m) => (m.id === id ? { ...m, likedByMe: !m.likedByMe, likeCount: m.likeCount + (m.likedByMe ? -1 : 1) } : m))
    );
    try {
      const data = await api(`/api/chat/dm/${id}/like`, { method: "POST" });
      setThread((prev) => prev.map((m) => (m.id === id ? data.message : m)));
    } catch {
      if (activePartner) fetchThread(partnerId);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center px-6">
        <InboxIcon className="h-7 w-7 text-neutral-700" />
        <p className="text-xs text-neutral-500">Sign in to send and receive private messages.</p>
        <button
          onClick={onSignInRequired}
          className="flex items-center gap-2 bg-[#39FF14] text-black text-[11px] font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all cursor-pointer"
        >
          <LogIn className="h-3.5 w-3.5" /> Sign In
        </button>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Messages</span>
          <button
            id="new-dm-btn"
            onClick={openDirectory}
            className="flex items-center gap-1 text-[10px] font-bold text-[#39FF14] hover:underline cursor-pointer"
          >
            <PenSquare className="h-3 w-3" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loadingList ? (
            <div className="flex items-center justify-center h-full text-neutral-600">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
              <InboxIcon className="h-6 w-6 text-neutral-700" />
              <p className="text-[11px] text-neutral-600">No conversations yet. Start one!</p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.userId}
                onClick={() => openThread(c)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <AvatarRenderer value={c.userAvatar} size={34} initials={c.userName?.[0]} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{c.userName}</span>
                    <span className="text-[9px] text-neutral-500 flex-shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className={`text-[11px] truncate ${c.unreadCount > 0 ? "text-neutral-200 font-semibold" : "text-neutral-500"}`}>
                    {c.lastMessage}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-[#39FF14] text-[9px] font-black text-black flex items-center justify-center flex-shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "new") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
          <button onClick={() => setView("list")} className="text-neutral-500 hover:text-white cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">New Message</span>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {directory.length === 0 ? (
            <p className="text-[11px] text-neutral-600 text-center px-6 pt-6">No other members yet.</p>
          ) : (
            directory.map((p) => (
              <button
                key={p.id}
                onClick={() => openThread(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <AvatarRenderer value={p.avatar} size={32} initials={p.name?.[0]} />
                <span className="text-xs font-bold text-white truncate">{p.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Thread view
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5">
        <button onClick={() => setView("list")} className="text-neutral-500 hover:text-white cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <AvatarRenderer value={partnerAvatar} size={26} initials={partnerName?.[0]} />
        <span className="text-xs font-bold text-white truncate">{partnerName}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-2.5">
        {thread.length === 0 ? (
          <p className="text-[11px] text-neutral-600 text-center pt-6">Say hello 👋</p>
        ) : (
          thread.map((m) => {
            const mine = m.fromUserId === myId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  {m.mediaType === "image" && m.mediaUrl && (
                    <img
                      src={m.mediaUrl}
                      alt="Shared attachment"
                      className="mb-1 max-w-[200px] max-h-[200px] rounded-2xl border border-white/10 object-cover cursor-pointer"
                      onClick={() => window.open(m.mediaUrl!, "_blank")}
                    />
                  )}
                  {m.mediaType === "audio" && m.mediaUrl && (
                    <div className="mb-1">
                      <VoiceBubble src={m.mediaUrl} />
                    </div>
                  )}
                  {m.text && (
                    <div
                      className={`rounded-2xl px-3 py-2 text-xs leading-relaxed break-words ${
                        mine ? "bg-[#39FF14] text-black font-medium" : "bg-white/5 border border-white/10 text-neutral-200"
                      }`}
                    >
                      {m.text}
                    </div>
                  )}
                  <div className={`flex items-center gap-1.5 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}>
                    <span className="text-[9px] text-neutral-600">{timeAgo(m.createdAt)}</span>
                    <button
                      onClick={() => toggleLike(m.id)}
                      className={`flex items-center gap-0.5 text-[9px] font-semibold cursor-pointer ${
                        m.likedByMe ? "text-[#39FF14]" : "text-neutral-600 hover:text-neutral-400"
                      }`}
                    >
                      <Heart className={`h-2.5 w-2.5 ${m.likedByMe ? "fill-[#39FF14]" : ""}`} />
                      {m.likeCount > 0 && m.likeCount}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <div className="px-4 pb-1 text-[10px] text-rose-400 font-semibold">{error}</div>}

      <div className="flex-none p-3 border-t border-white/5 bg-black/40">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
        {pendingImage && <PendingImageStrip url={pendingImage} onClear={() => setPendingImage(null)} />}

        {isRecording ? (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <span className="flex-1 text-xs font-bold text-rose-300">
              Recording voice message… {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
            </span>
            <button
              onClick={stopRecording}
              title="Stop and send"
              className="flex-shrink-0 h-9 w-9 rounded-xl bg-rose-500 hover:brightness-110 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePickImage}
              title="Attach an image"
              className="flex-shrink-0 h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-[#39FF14] transition-all cursor-pointer"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !sending && handleSend(pendingImage || undefined, pendingImage ? "image" : undefined)}
              placeholder="Type a message..."
              maxLength={2000}
              className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/50 focus:outline-none rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 transition-colors"
            />
            {!text.trim() && !pendingImage ? (
              <button
                onClick={startRecording}
                title="Record a voice message"
                className="flex-shrink-0 h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-[#39FF14] transition-all cursor-pointer"
              >
                <Mic className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSend(pendingImage || undefined, pendingImage ? "image" : undefined)}
                disabled={sending}
                className="flex-shrink-0 h-9 w-9 rounded-xl bg-[#39FF14] hover:brightness-110 disabled:opacity-40 flex items-center justify-center text-black transition-all cursor-pointer"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
