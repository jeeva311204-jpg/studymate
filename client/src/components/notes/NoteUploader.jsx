import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Upload,
  FileText,
  Clipboard,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

const SUGGESTED_TOPICS = [
  'Java Programming Language',
  'Database Management Systems (DBMS)',
  'Operating Systems',
  'Computer Networks',
  'Data Structures & Algorithms',
  'Object-Oriented Programming (OOPs)',
  'Python Programming',
  'Machine Learning & AI',
  'Software Engineering',
  'Compiler Design',
  'Cloud Computing',
];

const NoteUploader = ({ onNoteCreated }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste' | 'topic'
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setError('');
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.pdf', '.txt', '.md'].includes(ext)) {
      setError('Please upload a PDF (.pdf) or Plain Text (.txt) file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15MB limit.');
      return;
    }
    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let res;
      if (activeTab === 'upload') {
        if (!selectedFile) {
          setError('Please select a PDF or TXT file to upload.');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (title.trim()) {
          formData.append('title', title.trim());
        }

        res = await api.post('/notes/upload', formData);
      } else if (activeTab === 'paste') {
        if (!pastedText.trim() || pastedText.trim().length < 15) {
          setError('Please paste at least 15 characters of study notes.');
          setLoading(false);
          return;
        }

        res = await api.post('/notes/paste', {
          title: title.trim() || undefined,
          content: pastedText.trim(),
        });
      } else {
        if (!topicInput.trim() || topicInput.trim().length < 2) {
          setError('Please enter a valid topic or subject name (e.g. "DBMS").');
          setLoading(false);
          return;
        }

        res = await api.post('/notes/from-topic', {
          topic: topicInput.trim(),
        });
      }

      if (res?.data?.summaryFailed) {
        setSuccess('Note saved successfully! AI summary generation failed or timed out — click the Retry Summary button to try again.');
      } else if (res?.data?.truncationNotice) {
        setSuccess(`Notes created and summarized successfully! (Notice: ${res.data.truncationNotice})`);
      } else {
        setSuccess(activeTab === 'topic' ? `Full study notes and summary generated for "${topicInput.trim()}"!` : 'Notes uploaded and summarized successfully!');
      }
      setTitle('');
      setPastedText('');
      setTopicInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onNoteCreated && res?.data?.note) {
        onNoteCreated(res.data.note);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('studymate_token');
        navigate('/login', { state: { message: 'Your session has expired. Please sign in again.' } });
        return;
      }
      const errorMsg =
        err.response?.data?.message || err.message || 'Failed to process and summarize note.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span>Add Study Material</span>
        </h2>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topic')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'topic'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Type Topic</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-2.5 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start space-x-2.5 text-emerald-700 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab !== 'topic' && (
          /* Title Input */
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Note Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intro to Neuroscience - Lecture 4"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs transition-all"
            />
          </div>
        )}

        {activeTab === 'upload' ? (
          /* File Upload Drop Zone */
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600 bg-slate-50/50 dark:bg-slate-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-2 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Click to browse or drop your document here
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Supports PDF or TXT files up to 15MB
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'paste' ? (
          /* Paste Text Editor */
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Paste Study Notes
              </label>
              <span className="text-[10px] text-slate-400">
                {pastedText.length} characters
              </span>
            </div>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste article, lecture transcript, book chapter, or revision points here..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs transition-all resize-y"
            />
          </div>
        ) : (
          /* Type Topic / Subject Direct Generator */
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Enter Subject or Topic
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Java, DBMS, Operating Systems, Computer Networks..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs transition-all"
                />
                <BookOpen className="w-4 h-4 text-brand-500 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Gemini will deeply analyze this topic, break it down into core important modules (e.g. Operators, Control Statements, Inheritance, Polymorphism for Java), generate deep notes, and compile AI-predicted likely exam questions (2M, 8M, 16M).
              </p>
            </div>

            {/* Quick Topic Chips */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                Quick Select Topic:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TOPICS.map((top) => (
                  <button
                    key={top}
                    type="button"
                    onClick={() => setTopicInput(top)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      topicInput === top
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600'
                    }`}
                  >
                    {top}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            (activeTab === 'upload' && !selectedFile) ||
            (activeTab === 'paste' && !pastedText.trim()) ||
            (activeTab === 'topic' && !topicInput.trim())
          }
          className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-md shadow-brand-500/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {activeTab === 'topic'
                  ? `Analyzing "${topicInput || 'topic'}" with Gemini (Breaking down into important topics & notes)...`
                  : 'Analyzing & Summarizing with Gemini...'}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {activeTab === 'topic'
                  ? 'Analyze Topic & Generate Gemini Notes + Likely Qs'
                  : 'Generate AI Summary'}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default NoteUploader;
