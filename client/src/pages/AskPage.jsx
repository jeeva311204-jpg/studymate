import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import {
  Sparkles,
  Send,
  HelpCircle,
  Copy,
  Check,
  Bookmark,
  FileText,
  Lightbulb,
  Zap,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Info,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  Menu,
  X,
  Clock,
  Image as ImageIcon,
  Paperclip,
  UploadCloud,
  Download,
  Code,
  Layers,
  RefreshCw,
} from 'lucide-react';

const MODES = [
  {
    id: 'auto',
    name: 'Auto (Smart)',
    description: 'AI detects the best format for your question',
    icon: Sparkles,
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    id: 'doubt',
    name: 'Doubt Solver',
    description: 'Clear explanation + simple real example',
    icon: HelpCircle,
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    id: 'mark2',
    name: '2 Marks (Short)',
    description: '2 to 3 concise exam sentences',
    icon: Zap,
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    id: 'mark8',
    name: '8 Marks (Medium)',
    description: '250-350 words with headings & key points',
    icon: FileText,
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'mark16',
    name: '16 Marks (Essay)',
    description: '500-700 words: Intro, Points, Diagram, Conclusion',
    icon: GraduationCap,
    badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  {
    id: 'short_notes',
    name: 'Short Notes',
    description: 'Bulleted key points for fast revision',
    icon: CheckCircle2,
    badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  {
    id: 'simple',
    name: 'Simple (Beginner)',
    description: 'Beginner-friendly explanation with analogy',
    icon: Lightbulb,
    badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    id: 'svg',
    name: 'Diagram (SVG)',
    description: 'Self-contained vector diagram you can view and download',
    icon: Layers,
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  {
    id: 'image',
    name: 'Generate Image',
    description: 'AI-generated educational illustration with Download button',
    icon: ImageIcon,
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
];

const DEFAULT_IMAGE_QUESTION = 'Explain what is shown in this image and answer anything that is asked in it.';
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const AskPage = () => {
  const [searchParams] = useSearchParams();

  // Active chat state
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTitle, setActiveTitle] = useState('New Chat');
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);

  // Conversations list & drawer state
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Rename & Delete modals
  const [renamingConversation, setRenamingConversation] = useState(null);
  const [renameInput, setRenameInput] = useState('');
  const [renamingLoading, setRenamingLoading] = useState(false);

  const [deletingConversation, setDeletingConversation] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Form input & options
  const [question, setQuestion] = useState('');
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [userNotes, setUserNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Attached image state
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [savedNoteMap, setSavedNoteMap] = useState({});
  const [capabilities, setCapabilities] = useState({ imageGeneration: false });

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch AI capabilities (checks if image generation is supported/configured)
  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        const res = await api.get('/ask/capabilities');
        if (res.data) {
          setCapabilities(res.data);
        }
      } catch (err) {
        console.error('Failed to load capabilities:', err);
      }
    };
    fetchCapabilities();
  }, []);

  const handleModeChange = (newMode) => {
    setSelectedMode(newMode);
    if (newMode === 'image' && !capabilities.imageGeneration) {
      setError("Image generation isn't enabled on this site yet. Try Diagram (SVG) for downloadable diagrams.");
    } else if (error === "Image generation isn't enabled on this site yet. Try Diagram (SVG) for downloadable diagrams.") {
      setError('');
    }
  };

  // Fetch all conversations
  const fetchConversations = async () => {
    setLoadingConversations(true);
    try {
      const res = await api.get('/ask/conversations');
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch user notes for reference selector
  useEffect(() => {
    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        const res = await api.get('/notes');
        setUserNotes(res.data.notes || []);
      } catch (err) {
        console.error('Failed to load user notes:', err);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchNotes();
  }, []);

  // Handle URL query param `?q=` or `?question=` from dashboard
  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('question');
    if (q && q.trim()) {
      setQuestion(q.trim());
      inputRef.current?.focus();
    }
    const noteIdParam = searchParams.get('noteId');
    if (noteIdParam) {
      setSelectedNoteId(noteIdParam);
    }
  }, [searchParams]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Image validation helper
  const handleValidateAndSetImage = (file) => {
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image size exceeds the 4 MB limit. Please choose a smaller photo.');
      return;
    }

    const allowedMime = ['image/png', 'image/jpeg', 'image/webp'];
    const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!allowedMime.includes(file.type) && !validExtension) {
      setError('Invalid image format. Only PNG, JPEG, and WebP are supported.');
      return;
    }

    setError('');
    setAttachedImage(file);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Load a conversation by ID
  const handleSelectConversation = async (conv) => {
    if (activeConversationId === conv.id) {
      setMobileDrawerOpen(false);
      return;
    }

    setActiveConversationId(conv.id);
    setActiveTitle(conv.title);
    setError('');
    handleRemoveImage();
    setMobileDrawerOpen(false);
    setLoadingConversation(true);

    try {
      const res = await api.get(`/ask/conversations/${conv.id}`);
      const convData = res.data.conversation || res.data;
      setMessages(convData.messages || []);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation messages.');
    } finally {
      setLoadingConversation(false);
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveTitle('New Chat');
    setMessages([]);
    setError('');
    setQuestion('');
    handleRemoveImage();
    setMobileDrawerOpen(false);
    inputRef.current?.focus();
  };

  // Submit question
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const trimmed = question.trim();

    // If no image is attached, question is strictly required
    if (!attachedImage) {
      if (!trimmed) {
        setError('Please enter a question to ask.');
        return;
      }
      if (trimmed.length < 3) {
        setError('Question must be at least 3 characters long.');
        return;
      }
      if (trimmed.length > 2000) {
        setError('Question exceeds the 2,000 character limit.');
        return;
      }
    } else {
      if (trimmed && trimmed.length > 2000) {
        setError('Question exceeds the 2,000 character limit.');
        return;
      }
    }

    // Capabilities check: block image generation request if disabled
    if (selectedMode === 'image' && !capabilities.imageGeneration) {
      setError("Image generation isn't enabled on this site yet. Try Diagram (SVG) for downloadable diagrams.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      let res;
      const requestConfig = {};
      if (selectedMode === 'image') {
        requestConfig.timeout = 90000; // 90 seconds timeout for image generation only
      }

      if (attachedImage) {
        // Multipart form-data for image attachment
        const formData = new FormData();
        formData.append('image', attachedImage);
        if (trimmed) {
          formData.append('question', trimmed);
        }
        formData.append('mode', selectedMode);
        if (selectedNoteId) {
          formData.append('noteId', selectedNoteId);
        }
        if (activeConversationId) {
          formData.append('conversationId', activeConversationId);
        }

        res = await api.post('/ask', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          ...requestConfig,
        });
      } else {
        // JSON payload for text-only question
        const payload = {
          question: trimmed,
          mode: selectedMode,
        };

        if (selectedNoteId) {
          payload.noteId = selectedNoteId;
        }

        if (activeConversationId) {
          payload.conversationId = activeConversationId;
        }

        res = await api.post('/ask', payload, requestConfig);
      }

      const { answer, svg, description, image, caption, mode, resolvedMode, truncated, conversationId } = res.data;

      // Update active conversation ID if newly created
      const effectiveQuestion = trimmed || DEFAULT_IMAGE_QUESTION;
      if (!activeConversationId && conversationId) {
        setActiveConversationId(conversationId);
        setActiveTitle(effectiveQuestion.slice(0, 60));
      }

      const actualResolvedMode = resolvedMode || mode || selectedMode;

      const newUserMsg = {
        role: 'user',
        content: effectiveQuestion,
        mode: selectedMode,
        hasImage: Boolean(attachedImage),
        createdAt: new Date(),
        noteTitle: userNotes.find((n) => n._id === selectedNoteId)?.title || null,
      };

      const newAiMsg = {
        role: 'assistant',
        content: answer || caption || svg || '',
        svg: svg || (actualResolvedMode === 'svg' ? answer : null),
        image: image || null,
        caption: caption || '',
        description: description || '',
        mode: actualResolvedMode,
        chosenMode: selectedMode,
        resolvedMode: actualResolvedMode,
        truncated: Boolean(truncated),
        hasImage: false,
        generatedImage: Boolean(image) || (actualResolvedMode === 'image'),
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, newUserMsg, newAiMsg]);
      setQuestion('');
      handleRemoveImage();

      // Refresh conversations list to update sidebar order & titles
      fetchConversations();
    } catch (err) {
      console.error('Ask AI error:', err);
      const rawMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to get answer from AI. Please try again.';
      setError(typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg));
    } finally {
      setLoading(false);
    }
  };

  // Rename conversation
  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setRenamingConversation(conv);
    setRenameInput(conv.title);
  };

  const handleConfirmRename = async (e) => {
    e.preventDefault();
    if (!renamingConversation) return;

    const trimmed = renameInput.trim();
    if (!trimmed || trimmed.length > 80) {
      alert('Title must be between 1 and 80 characters.');
      return;
    }

    setRenamingLoading(true);
    try {
      await api.patch(`/ask/conversations/${renamingConversation.id}`, {
        title: trimmed,
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === renamingConversation.id ? { ...c, title: trimmed } : c
        )
      );

      if (activeConversationId === renamingConversation.id) {
        setActiveTitle(trimmed);
      }

      setRenamingConversation(null);
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      alert(err.response?.data?.message || 'Failed to rename conversation.');
    } finally {
      setRenamingLoading(false);
    }
  };

  // Delete conversation
  const handleStartDelete = (e, conv) => {
    e.stopPropagation();
    setDeletingConversation(conv);
  };

  const handleConfirmDelete = async () => {
    if (!deletingConversation) return;

    setDeletingLoading(true);
    try {
      await api.delete(`/ask/conversations/${deletingConversation.id}`);

      setConversations((prev) =>
        prev.filter((c) => c.id !== deletingConversation.id)
      );

      if (activeConversationId === deletingConversation.id) {
        handleNewChat();
      }

      setDeletingConversation(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert(err.response?.data?.message || 'Failed to delete conversation.');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleDownloadSvg = (svgText) => {
    if (!svgText) return;
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadGeneratedImage = (imageObj, promptText) => {
    if (!imageObj || !imageObj.data) return;
    const mimeType = imageObj.mimeType || 'image/png';
    const byteCharacters = atob(imageObj.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const cleanPrompt =
      (promptText || 'illustration')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'illustration';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanPrompt}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRegenerateImage = (promptText) => {
    if (!promptText) return;
    setQuestion(promptText);
    setSelectedMode('image');
    inputRef.current?.focus();
  };

  const handleSaveAsNote = async (msgId, userQuestion, aiAnswer, mode) => {
    setSavingNoteId(msgId);
    try {
      const title = `AI Answer: ${userQuestion.slice(0, 60)}${userQuestion.length > 60 ? '...' : ''}`;
      const content = `## Question\n${userQuestion}\n\n## AI Explanation (${(mode || 'AUTO').toUpperCase()})\n${aiAnswer}\n\n---\n*Saved from StudyMate Ask AI on ${new Date().toLocaleDateString()}*`;

      await api.post('/notes/paste', {
        title,
        content,
      });

      setSavedNoteMap((prev) => ({ ...prev, [msgId]: true }));
    } catch (err) {
      console.error('Save note error:', err);
      const msg =
        err.response?.data?.message ||
        'Failed to save answer as note. If you reached the 50-note limit, please delete some notes.';
      setError(msg);
    } finally {
      setSavingNoteId(null);
    }
  };

  const currentModeObj = MODES.find((m) => m.id === selectedMode) || MODES[0];

  // Helper to render sidebar content
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
      {/* Sidebar Header & New Chat Button */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Chat History</span>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {conversations.length}/30
          </span>
        </div>

        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {loadingConversations && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs">No saved chats yet.</p>
            <p className="text-[11px] text-slate-400">
              Start asking questions to build your study history.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl text-left cursor-pointer transition-all ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800/80 shadow-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs font-medium truncate leading-snug">
                    {conv.title}
                  </p>
                  <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatTimeAgo(conv.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleStartRename(e, conv)}
                    title="Rename conversation"
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleStartDelete(e, conv)}
                    title="Delete conversation"
                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 text-center">
        Chats expire automatically after 90 days.
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 animate-fadeIn">
      {/* Top Mobile Bar */}
      <div className="flex md:hidden items-center justify-between mb-4 px-2">
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm"
        >
          <Menu className="w-4 h-4 text-brand-600" />
          <span>History ({conversations.length})</span>
        </button>

        <button
          onClick={handleNewChat}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-semibold shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl min-h-[calc(100vh-8rem)]">
        {/* Desktop Left Sidebar */}
        <aside className="hidden md:block w-72 lg:w-80 flex-shrink-0">
          {renderSidebarContent()}
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />

            <div className="relative w-72 max-w-[80vw] h-full z-10 shadow-2xl flex flex-col">
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50/40 dark:bg-slate-950/40">
          {/* Header Banner */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                  <span>Ask AI</span>
                </span>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {activeTitle}
                </h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate">
                {activeConversationId
                  ? `${messages.length}/40 messages in this conversation`
                  : 'Start a new conversation or ask directly'}
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-center">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${currentModeObj.badgeColor}`}>
                {currentModeObj.name}
              </span>
            </div>
          </div>

          {/* Messages Feed Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loadingConversation ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                <p className="text-sm">Loading conversation messages...</p>
              </div>
            ) : messages.length === 0 ? (
              /* Welcome / Empty State */
              <div className="space-y-6 max-w-3xl mx-auto py-4">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-brand-500/10">
                  <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>StudyMate AI Assistant</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      Academic Q&A, Visual Problems & Concept Clarification
                    </h2>
                    <p className="mt-2 text-slate-100/90 text-xs sm:text-sm leading-relaxed">
                      Attach textbook diagrams, formulas, handwritten problems, or ask syllabus questions in 2-mark, 8-mark, 16-mark essay, or step-by-step doubt solver mode.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setQuestion('Explain process scheduling algorithms with examples')}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600">
                      <HelpCircle className="w-4 h-4 text-brand-500" />
                      <span>Operating Systems</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      "Explain process scheduling algorithms with examples"
                    </p>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600">
                      <ImageIcon className="w-4 h-4 text-indigo-500" />
                      <span>Diagram or Problem Photo</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Click to attach a textbook diagram or handwritten problem (PNG/JPEG/WebP)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Render Messages */
              messages.map((item, index) => {
                const isUser = item.role === 'user';
                const msgId = item._id || index.toString();
                const prevUserMsg = !isUser && index > 0 && messages[index - 1].role === 'user' ? messages[index - 1] : null;
                const chosenMode = item.chosenMode || (prevUserMsg ? prevUserMsg.mode : null);
                const resolvedMode = item.resolvedMode || item.mode;
                const hasSwitchedMode = Boolean(!isUser && chosenMode && resolvedMode && chosenMode !== resolvedMode);

                const modeDef = MODES.find((m) => m.id === (item.mode || resolvedMode)) || MODES[0];
                const isCopied = copiedId === msgId;
                const isSaved = savedNoteMap[msgId];
                const isSaving = savingNoteId === msgId;

                const userQuestionText = prevUserMsg ? prevUserMsg.content : 'illustration';

                if (isUser) {
                  return (
                    <div key={msgId} className="flex justify-end">
                      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1.5">
                              <span className="w-5 h-5 rounded-lg bg-brand-600 text-white flex items-center justify-center text-[10px]">
                                Q
                              </span>
                              <span>You</span>
                            </span>
                            {item.hasImage && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold border border-indigo-200 dark:border-indigo-800">
                                <ImageIcon className="w-3 h-3" />
                                <span>image attached</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msgId} className="flex justify-start">
                    <div className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                      {/* AI Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              StudyMate AI
                            </span>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                              <span>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {item.truncated && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-500 font-medium">Context truncated</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {hasSwitchedMode && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                              {resolvedMode === 'image'
                                ? 'Switched to Generate image mode'
                                : resolvedMode === 'svg'
                                ? 'Switched to Diagram mode'
                                : `Switched to ${resolvedMode} mode`}
                            </span>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${modeDef.badgeColor}`}>
                            {modeDef.name}
                          </span>
                        </div>
                      </div>

                      {/* Generated Image, SVG Diagram, or Markdown Body */}
                      {item.mode === 'image' || item.generatedImage ? (
                        <div className="space-y-4">
                          {item.image && item.image.data ? (
                            <>
                              <div className="flex flex-col items-center justify-center p-4 bg-slate-100/80 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                                <img
                                  src={`data:${item.image.mimeType || 'image/png'};base64,${item.image.data}`}
                                  alt={item.caption || item.content || 'Generated Educational Illustration'}
                                  className="max-w-full max-h-[500px] object-contain rounded-xl select-none shadow-md"
                                />
                              </div>

                              <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                                <span>Generated images are not saved in your history. Download it now.</span>
                              </div>

                              {item.caption && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                  {item.caption}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="space-y-2 p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <ImageIcon className="w-4 h-4 text-emerald-500" />
                                <span>Generated Illustration (Session Expired)</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {item.content}
                              </p>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400 dark:text-slate-500 italic pt-1">
                                <Info className="w-3.5 h-3.5" />
                                <span>Generated images are not stored permanently. Click Regenerate below to recreate it.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : item.mode === 'svg' || item.svg ? (
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center p-4 bg-slate-100/80 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                            <img
                              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg || item.content)}`}
                              alt={item.description || 'Generated Diagram SVG'}
                              className="max-w-full max-h-[500px] object-contain rounded-xl select-none"
                            />
                          </div>

                          {item.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => (
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-5 mb-2.5 border-b border-slate-100 dark:border-slate-800 pb-2" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2 text-brand-600 dark:text-brand-400" {...props} />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-1.5" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul className="space-y-1.5 my-2.5 list-disc list-inside text-slate-700 dark:text-slate-300" {...props} />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="space-y-1.5 my-2.5 list-decimal list-inside text-slate-700 dark:text-slate-300" {...props} />
                              ),
                              li: ({ node, ...props }) => (
                                <li className="leading-relaxed marker:text-brand-500" {...props} />
                              ),
                              strong: ({ node, ...props }) => (
                                <strong className="font-bold text-slate-900 dark:text-white" {...props} />
                              ),
                              code: ({ node, inline, ...props }) =>
                                inline ? (
                                  <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-xs text-brand-600 dark:text-brand-400" {...props} />
                                ) : (
                                  <code className="block p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto my-3" {...props} />
                                ),
                              table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs" {...props} />
                                </div>
                              ),
                              th: ({ node, ...props }) => (
                                <th className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300 text-left" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="px-3 py-2 border-t border-slate-100 dark:border-slate-800" {...props} />
                              ),
                            }}
                          >
                            {item.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Action Row */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          {item.mode === 'image' || item.generatedImage ? (
                            <>
                              {item.image && item.image.data && (
                                <button
                                  onClick={() => handleDownloadGeneratedImage(item.image, userQuestionText)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                                  title="Download illustration"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleRegenerateImage(userQuestionText)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center space-x-1.5 transition-colors"
                                title="Regenerate this image"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate</span>
                              </button>
                            </>
                          ) : item.mode === 'svg' || item.svg ? (
                            <>
                              <button
                                onClick={() => handleDownloadSvg(item.svg || item.content)}
                                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                                title="Download as diagram.svg"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download SVG</span>
                              </button>

                              <button
                                onClick={() => handleCopy(msgId + '-svg', item.svg || item.content)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center space-x-1.5 transition-colors"
                                title="Copy raw SVG code"
                              >
                                {copiedId === msgId + '-svg' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">SVG Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Code className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Copy SVG code</span>
                                  </>
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCopy(msgId, item.content)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center space-x-1.5 transition-colors"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Copy Answer</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() =>
                              handleSaveAsNote(
                                msgId,
                                userQuestionText,
                                item.mode === 'svg' || item.svg
                                  ? `${item.description ? item.description + '\n\n' : ''}\`\`\`xml\n${item.svg || item.content}\n\`\`\``
                                  : item.content,
                                item.mode
                              )
                            }
                            disabled={isSaving || isSaved}
                            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition-all ${
                              isSaved
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800'
                            }`}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : isSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Saved to Notes</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-3.5 h-3.5 text-brand-500" />
                                <span>Save as Note</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 dark:text-slate-500 italic">
                          <Info className="w-3 h-3 text-slate-400" />
                          <span>AI-generated. Verify with textbooks.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* In-flight Loading Spinner */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedMode === 'image'
                        ? 'Generating your image, this can take up to a minute'
                        : `Analyzing ${attachedImage ? 'Image & Question' : 'Question'} in ${currentModeObj.name}...`}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedMode === 'image'
                        ? 'Creating clean educational illustration with Gemini AI.'
                        : 'Referencing academic concepts and preparing syllabus explanation.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Query & Form Box with Drag-and-Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleValidateAndSetImage(e.dataTransfer.files[0]);
              }
            }}
            className={`p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors ${
              isDragging ? 'bg-brand-50/50 dark:bg-brand-950/30 border-dashed border-2 border-brand-500' : ''
            }`}
          >
            <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl mx-auto">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleValidateAndSetImage(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {/* Thumbnail Preview Area */}
              {imagePreviewUrl && (
                <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 animate-fadeIn">
                  <div className="relative group">
                    <img
                      src={imagePreviewUrl}
                      alt="Thumbnail preview"
                      className="w-14 h-14 object-cover rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {attachedImage?.name || 'Attached Image'}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {(attachedImage?.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    title="Remove attached image"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Question Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <label htmlFor="ai-question-input" className="flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>
                      {attachedImage
                        ? 'Question / Guidance for Image (Optional):'
                        : 'Your Academic Question:'}
                    </span>
                  </label>
                  <span className={`text-[11px] ${question.length > 2000 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                    {question.length} / 2000
                  </span>
                </div>

                <textarea
                  id="ai-question-input"
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (!loading && (question.trim() || attachedImage)) handleSubmit();
                    }
                  }}
                  rows={3}
                  placeholder={
                    attachedImage
                      ? "Ask a specific question about the image (e.g. 'Solve problem 3 step-by-step'), or leave blank to explain the full image..."
                      : "Type your question here, or drag & drop a diagram/problem image. Press Ctrl+Enter to ask..."
                  }
                  className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm leading-relaxed resize-none transition-all"
                  disabled={loading}
                />
              </div>

              {/* Mode Selector & Context Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-brand-500" />
                    <span>Response Mode:</span>
                  </label>
                  <select
                    value={selectedMode}
                    onChange={(e) => handleModeChange(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <BookOpen className="w-3 h-3 text-indigo-500" />
                    <span>Context Note (Optional):</span>
                  </label>
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    disabled={loading || loadingNotes}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="">None (Ask syllabus directly)</option>
                    {userNotes.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 flex items-start space-x-2.5 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                  <p className="font-semibold flex-1">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="p-1 rounded-lg text-red-400 hover:text-red-700 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    title="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center space-x-2">
                  {/* Attach Image Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>{attachedImage ? 'Change Image' : 'Attach Photo / Diagram'}</span>
                  </button>

                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    PNG, JPEG, WebP (max 4 MB)
                  </span>
                </div>

                <div className="flex items-center space-x-3 ml-auto">
                  <p className="text-[11px] text-slate-400 hidden md:block">
                    Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">Ctrl+Enter</kbd> to ask.
                  </p>

                  <button
                    type="submit"
                    disabled={loading || (!question.trim() && !attachedImage)}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Ask AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* Rename Dialog Modal */}
      {renamingConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <span>Rename Conversation</span>
              </h3>
              <button
                onClick={() => setRenamingConversation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRename} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Title (1-80 characters):
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenamingConversation(null)}
                  disabled={renamingLoading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renamingLoading || !renameInput.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {renamingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Title</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Conversation?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold">"{deletingConversation.title}"</span>? All messages in this chat will be permanently removed.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingConversation(null)}
                disabled={deletingLoading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                {deletingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AskPage;
