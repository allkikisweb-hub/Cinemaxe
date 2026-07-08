import { useEffect, useState, useCallback } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Trash2, Image as ImageIcon, MessageSquare, Inbox, ArrowLeft, Send, Plus, Search } from 'lucide-react';

interface MessagesProps {
  search: string;
  onReadChange: () => void;
}

export default function Messages({ search, onReadChange }: MessagesProps) {
  const [tab, setTab] = useState<'global' | 'inbox'>('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busySend, setBusySend] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');

  const loadGlobal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await websiteApi.getChatMessages(search || undefined)) as any;
      setMessages(data.messages || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadConversations = useCallback(async () => {
    setInboxLoading(true);
    setError(null);
    try {
      const data = (await websiteApi.getChatConversations()) as any;
      setConversations(data.conversations || []);
      onReadChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInboxLoading(false);
    }
  }, [onReadChange]);

  const loadThread = useCallback(async (userId: string) => {
    setThreadLoading(true);
    setThread([]);
    setError(null);
    try {
      const data = (await websiteApi.getChatThread(userId)) as any;
      setThread(data.messages || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setError(null);
    try {
      const data = (await websiteApi.getChatDirectory()) as any;
      setDirectory(data.people || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'global') {
      loadGlobal();
    } else {
      loadConversations();
    }
  }, [tab, loadGlobal, loadConversations]);

  const remove = async (id: string) => {
    if (!confirm('Delete this message from Live Chat permanently?')) return;
    setBusyId(id);
    try {
      await websiteApi.deleteChatMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openConversation = async (conversation: any) => {
    setActiveConversation(conversation);
    setShowDirectory(false);
    await loadThread(conversation.userId);
  };

  const startNewConversation = async () => {
    setShowDirectory(true);
    if (directory.length === 0) {
      await loadDirectory();
    }
  };

  const selectDirectoryPerson = async (person: any) => {
    const existing = conversations.find((c) => c.userId === person.id);
    const conversation = existing || {
      userId: person.id,
      userName: person.name,
      userAvatar: person.avatar,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };
    setActiveConversation(conversation);
    setShowDirectory(false);
    await loadThread(person.id);
  };

  const sendMessage = async () => {
    if (!activeConversation || !messageText.trim()) return;
    setBusySend(true);
    setError(null);
    try {
      const data = (await websiteApi.sendChatMessage(activeConversation.userId, { text: messageText.trim() })) as any;
      setThread((prev) => [...prev, data.message]);
      setMessageText('');
      await loadConversations();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusySend(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Live Chat</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage the global Popular feed and private user inbox conversations from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('global')}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition ${tab === 'global' ? 'bg-[#39FF14] text-black' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}`}
          >
            Global Chat
          </button>
          <button
            onClick={() => setTab('inbox')}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition ${tab === 'inbox' ? 'bg-[#39FF14] text-black' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}`}
          >
            Direct Inbox
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>}

      {tab === 'global' ? (
        loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet — they'll show up here as soon as visitors start chatting.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {m.userAvatar && !m.userAvatar.startsWith('anim:') && !m.userAvatar.startsWith('cartoon:') ? (
                  <img src={m.userAvatar} alt={m.userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                    {m.userName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{m.userName}</p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  {m.text && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{m.text}</p>}
                  {m.mediaType === 'image' && m.mediaUrl && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-faint)' }} />
                      <img src={m.mediaUrl} alt="Attachment" className="h-16 w-16 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>
                <button
                  title="Delete"
                  onClick={() => remove(m.id)}
                  disabled={busyId === m.id}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="glass-card rounded-3xl p-4 min-h-[520px] flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Inbox className="h-4 w-4" /> Conversations
              </div>
              <button
                onClick={startNewConversation}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 text-xs font-bold text-[#39FF14] hover:bg-white/10 transition"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            </div>

            {showDirectory ? (
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {directoryLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
                  </div>
                ) : directory.length === 0 ? (
                  <div className="text-sm text-neutral-500">No users available for direct messaging.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        value={directorySearch}
                        onChange={(e) => setDirectorySearch(e.target.value)}
                        placeholder="Search users..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#39FF14]/50"
                      />
                    </div>
                    {directory.filter((p) => p.name.toLowerCase().includes(directorySearch.toLowerCase())).map((person) => (
                      <button
                        key={person.id}
                        onClick={() => selectDirectoryPerson(person)}
                        className="w-full rounded-2xl border border-white/10 p-3 text-left hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#39FF14]/10 flex items-center justify-center text-sm font-bold text-[#39FF14]">{person.name?.[0]?.toUpperCase() || '?'}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                            <p className="text-[10px] text-neutral-500 truncate">User ID: {person.id}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : inboxLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-neutral-500">
                <MessageSquare className="h-10 w-10" />
                <p className="text-sm">No direct messages yet. Start a conversation with any active user.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.userId}
                    onClick={() => openConversation(conv)}
                    className={`w-full rounded-2xl p-3 text-left border ${activeConversation?.userId === conv.userId ? 'border-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 bg-white/5 hover:bg-white/10'} transition`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{conv.userName}</p>
                        <p className="text-[10px] text-neutral-500 truncate">{conv.lastMessage || 'No messages yet'}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="h-5 min-w-[20px] rounded-full bg-[#39FF14] text-black text-[10px] font-black flex items-center justify-center px-2">{conv.unreadCount}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-2">{new Date(conv.lastMessageAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-4 min-h-[520px] flex flex-col">
            {activeConversation ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setActiveConversation(null)} className="text-neutral-500 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <p className="text-sm font-bold text-white">{activeConversation.userName}</p>
                    <p className="text-[10px] text-neutral-500">Conversation thread</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-4">
                  {threadLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="text-sm text-neutral-500">No messages yet. Send the first response to start the conversation.</div>
                  ) : (
                    thread.map((msg) => {
                      const mine = msg.fromUserId !== activeConversation.userId;
                      return (
                        <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? 'bg-[#39FF14] text-black' : 'bg-white/5 border border-white/10 text-neutral-200'}`}>
                            {msg.text}
                            {msg.mediaType === 'image' && msg.mediaUrl && (
                              <img src={msg.mediaUrl} alt="Attachment" className="mt-2 rounded-xl max-w-full object-cover" />
                            )}
                            {msg.mediaType === 'audio' && msg.mediaUrl && (
                              <audio controls src={msg.mediaUrl} className="mt-2 w-full" />
                            )}
                            <div className="text-[10px] text-neutral-500 mt-2 text-right">{new Date(msg.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={3}
                    placeholder="Write a message..."
                    className="w-full bg-white/5 border border-white/10 rounded-3xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#39FF14]/50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={busySend || !messageText.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#39FF14] text-black py-3 text-sm font-bold hover:brightness-110 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> Send Message
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-neutral-500">
                <MessageSquare className="h-10 w-10" />
                <p className="text-sm">Select a conversation or start a new message to respond to visitors directly.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
