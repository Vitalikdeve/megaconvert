import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Zap, ShieldCheck, Globe2, ServerCog, Users2, Activity, Clock3, Cpu, Sparkles,
  Image as ImageIcon, FileText, Music, Video,
  ChevronRight, ChevronDown, Crown, Box, Mail, Github, Lock, X
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';

import SeoPage from './SeoPage';
import { translations, defaultLang } from './i18n';

// --- Firebase ---
const firebaseConfig = {
  apiKey: 'AIzaSyDT7-w-qd3c_MhmuxUjHigi9p1ZL8iMmII',
  authDomain: 'megaconvert2026.firebaseapp.com',
  projectId: 'megaconvert2026',
  storageBucket: 'megaconvert2026.firebasestorage.app',
  messagingSenderId: '135783756092',
  appId: '1:135783756092:web:4de3daada1bde5e5112e39',
  measurementId: 'G-356FHKB2V0'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Languages ---
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'be', name: 'Беларуская', flag: '🇧🇾' }
];



const toolIcon = (type) => {
  if (type === 'doc') return <FileText size={18} />;
  if (type === 'image') return <ImageIcon size={18} />;
  if (type === 'video') return <Video size={18} />;
  if (type === 'audio') return <Music size={18} />;
  return <Box size={18} />;
};

const tools = [
  { id: 'pdf-word', name: 'PDF to Word', type: 'doc', accept: '.pdf' },
  { id: 'pdf-excel', name: 'PDF to Excel', type: 'doc', accept: '.pdf' },
  { id: 'pdf-pptx', name: 'PDF to PowerPoint', type: 'doc', accept: '.pdf' },
  { id: 'word-pdf', name: 'Word to PDF', type: 'doc', accept: '.doc,.docx' },
  { id: 'excel-pdf', name: 'Excel to PDF', type: 'doc', accept: '.xls,.xlsx' },
  { id: 'pptx-pdf', name: 'PowerPoint to PDF', type: 'doc', accept: '.ppt,.pptx' },
  { id: 'pdf-txt', name: 'PDF to TXT', type: 'doc', accept: '.pdf' },
  { id: 'txt-pdf', name: 'TXT to PDF', type: 'doc', accept: '.txt' },
  { id: 'image-pdf', name: 'Image to PDF', type: 'image', accept: 'image/*' },
  { id: 'pdf-images', name: 'PDF to Images', type: 'doc', accept: '.pdf' },
  { id: 'png-jpg', name: 'PNG to JPG', type: 'image', accept: 'image/png' },
  { id: 'jpg-png', name: 'JPG to PNG', type: 'image', accept: 'image/jpeg, image/jpg' },
  { id: 'jpg-webp', name: 'JPG to WEBP', type: 'image', accept: 'image/jpeg, image/jpg' },
  { id: 'png-webp', name: 'PNG to WEBP', type: 'image', accept: 'image/png' },
  { id: 'heic-jpg', name: 'HEIC to JPG', type: 'image', accept: '.heic' },
  { id: 'avif-jpg', name: 'AVIF to JPG', type: 'image', accept: '.avif' },
  { id: 'avif-png', name: 'AVIF to PNG', type: 'image', accept: '.avif' },
  { id: 'svg-png', name: 'SVG to PNG', type: 'image', accept: '.svg' },
  { id: 'svg-jpg', name: 'SVG to JPG', type: 'image', accept: '.svg' },
  { id: 'jpg-pdf', name: 'JPG to PDF', type: 'doc', accept: 'image/jpeg, image/jpg' },
  { id: 'compress-pdf', name: 'Compress PDF', type: 'doc', accept: '.pdf' },
  { id: 'mp4-mp3', name: 'MP4 to MP3', type: 'video', accept: 'video/mp4' },
  { id: 'mp4-gif', name: 'MP4 to GIF', type: 'video', accept: 'video/mp4' },
  { id: 'mov-mp4', name: 'MOV to MP4', type: 'video', accept: 'video/quicktime' },
  { id: 'mkv-mp4', name: 'MKV to MP4', type: 'video', accept: '.mkv' },
  { id: 'avi-mp4', name: 'AVI to MP4', type: 'video', accept: '.avi' },
  { id: 'video-webm', name: 'Video to WEBM', type: 'video', accept: 'video/*' },
  { id: 'compress-video', name: 'Compress Video', type: 'video', accept: 'video/*' },
  { id: 'mp3-wav', name: 'MP3 to WAV', type: 'audio', accept: 'audio/mpeg' },
  { id: 'wav-mp3', name: 'WAV to MP3', type: 'audio', accept: 'audio/wav' },
  { id: 'm4a-mp3', name: 'M4A to MP3', type: 'audio', accept: 'audio/*' },
  { id: 'flac-mp3', name: 'FLAC to MP3', type: 'audio', accept: 'audio/flac' },
  { id: 'ogg-mp3', name: 'OGG to MP3', type: 'audio', accept: 'audio/ogg' },
  { id: 'audio-aac', name: 'Audio to AAC', type: 'audio', accept: 'audio/*' },
  { id: 'zip-rar', name: 'ZIP to RAR', type: 'archive', accept: '.zip' },
  { id: 'rar-zip', name: 'RAR to ZIP', type: 'archive', accept: '.rar' },
  { id: '7z-zip', name: '7Z to ZIP', type: 'archive', accept: '.7z' },
  { id: 'zip-tar', name: 'ZIP to TAR', type: 'archive', accept: '.zip' },
  { id: 'ocr', name: 'OCR (Image to Text)', type: 'image', accept: 'image/*' },
  { id: 'cad-pdf', name: 'CAD to PDF', type: 'doc', accept: '.dxf,.dwg' }
].map((t) => ({ ...t, icon: toolIcon(t.type), isPro: false }));

const categories = [
  { id: 'all', label: 'All' },
  { id: 'doc', label: 'Documents' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'archive', label: 'Archives' }
];

const topToolIds = ['pdf-word', 'mp4-mp3', 'heic-jpg', 'jpg-pdf', 'compress-pdf'];

const EXT_SUGGEST_MAP = {
  pdf: 'pdf-word',
  doc: 'word-pdf',
  docx: 'word-pdf',
  xls: 'excel-pdf',
  xlsx: 'excel-pdf',
  ppt: 'pptx-pdf',
  pptx: 'pptx-pdf',
  png: 'png-jpg',
  jpg: 'jpg-png',
  jpeg: 'jpg-png',
  heic: 'heic-jpg',
  avif: 'avif-jpg',
  svg: 'svg-png',
  mp4: 'mp4-mp3',
  mov: 'mov-mp4',
  mkv: 'mkv-mp4',
  avi: 'avi-mp4',
  mp3: 'mp3-wav',
  wav: 'wav-mp3',
  m4a: 'm4a-mp3',
  flac: 'flac-mp3',
  ogg: 'ogg-mp3',
  zip: 'zip-rar',
  rar: 'rar-zip',
  '7z': '7z-zip',
  txt: 'txt-pdf'
};

const inferToolFromName = (name) => {
  const ext = (name || '').toLowerCase().split('.').pop();
  if (!ext || ext === name.toLowerCase()) return null;
  return EXT_SUGGEST_MAP[ext] || null;
};

const GlassCard = ({ children }) => (
  <div className="bg-white/80 backdrop-blur-2xl border border-white/50 shadow-xl shadow-blue-900/5 rounded-2xl p-2 md:p-3 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
    <div className="bg-white/60 rounded-2xl p-8 md:p-12 border border-white/60 min-h-[400px] flex flex-col items-center justify-center transition-all">
      {children}
    </div>
  </div>
);

const ProcessDemo = () => (
  <div className="relative rounded-2xl border border-slate-200 bg-white/80 p-6 overflow-hidden shadow-lg">
    <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-200/70 to-indigo-200/40 rounded-full blur-2xl" />
    <div className="flex items-center justify-between text-sm text-slate-500">
      <span className="font-semibold text-slate-700 flex items-center gap-2"><Sparkles size={16} /> Live conversion</span>
      <span className="px-2 py-1 rounded-full bg-slate-100 text-xs">Demo</span>
    </div>
    <div className="mt-5 space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 demo-step demo-step-1">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">PDF</div>
        <div className="flex-1">
          <div className="font-semibold">Drop your file</div>
          <div className="text-xs text-slate-500">Drag & drop or select</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white border border-slate-200 demo-step demo-step-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Converting</span>
          <span className="text-slate-500">72%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 demo-progress" />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 demo-step demo-step-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
          <CheckCircle2 size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold">File ready</div>
          <div className="text-xs text-emerald-700">Download in one click</div>
        </div>
      </div>
    </div>
  </div>
);

const Section = ({ children, id = "", className = "", ...rest }) => (
  <section id={id} className={`py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto ${className}`} {...rest}>
    {children}
  </section>
);

const Button = ({ children, onClick, variant = "primary", className = "", size = "normal", ...rest }) => {
  const sizes = { normal: "px-6 py-3 text-sm", large: "px-8 py-4 text-lg w-full md:w-auto" };
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg",
    secondary: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200",
    pro: "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg",
    outline: "border-2 border-slate-200 text-slate-600"
  };
  return (
    <button onClick={onClick} className={`font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${colors[color]}`}>{children}</span>;
};

export default function App() {
  const [lang, setLang] = useState(defaultLang);
  const t = { ...translations.en, ...(translations[lang] || {}) };

  const [path, setPath] = useState(() => window.location.pathname);
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [twofaVerified, setTwofaVerified] = useState(false);
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaError, setTwofaError] = useState('');
  const [twofaStatus, setTwofaStatus] = useState('idle');
  const [showTwofaModal, setShowTwofaModal] = useState(false);

  const [filesConvertedCount, setFilesConvertedCount] = useState(1199823);
  const [showCookie, setShowCookie] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [smartSuggestion, setSmartSuggestion] = useState(null);
  const [recentJobs, setRecentJobs] = useState(() => {
    try {
      const raw = localStorage.getItem('recent_jobs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [accountNotice, setAccountNotice] = useState('');

  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('png-jpg');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [settings, setSettings] = useState({
    image: { quality: 90, resize: "", crop: "", dpi: "" },
    video: { resolution: "1080p", fps: "", bitrate: "", codec: "h264" },
    audio: { bitrate: "192k", normalize: false, trimStart: "", trimDuration: "", channels: "" }
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [pendingOpenToolId, setPendingOpenToolId] = useState(null);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const fileInputRef = useRef(null);
  const langMenuRef = useRef(null);
  const jobStartRef = useRef(null);

  const toolIds = useMemo(() => new Set(tools.map((t) => t.id)), []);
  const currentTool = tools.find(t => t.id === activeTab) || tools[0];
  const topTools = tools.filter((t) => topToolIds.includes(t.id));

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredTools = tools.filter((t) => {
    const categoryMatch = activeCategory === 'all' || t.type === activeCategory;
    const queryMatch = !normalizedQuery || t.name.toLowerCase().includes(normalizedQuery) || t.id.includes(normalizedQuery);
    return categoryMatch && queryMatch;
  });
  const showAll = showAllFormats || normalizedQuery.length > 0;
  const visibleTools = showAll ? filteredTools : filteredTools.slice(0, 12);

  const navigate = (to) => {
    if (to === path) return;
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToFormats = () => {
    const el = document.getElementById('formats');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToConverter = () => {
    const el = document.getElementById('converter');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToId = (id) => {
    if (path !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const handleFilesSelected = (list) => {
    const selected = Array.from(list || []);
    setFiles(selected);
    setFile(selected[0] || null);
    if (selected[0]) {
      const suggested = inferToolFromName(selected[0].name);
      if (suggested) setSmartSuggestion(suggested);
    } else {
      setSmartSuggestion(null);
    }
  };

  const track = (type, payload = {}) => {
    try {
      const body = JSON.stringify({ type, payload, ts: Date.now() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE}/events`, blob);
      } else {
        fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  };

  
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const baseKeys = Object.keys(translations.en);
    Object.entries(translations).forEach(([code, dict]) => {
      const missing = baseKeys.filter((k) => !(k in dict));
      if (missing.length) {
        console.warn('i18n missing keys for ' + code + ': ' + missing.join(', '));
      }
    });
  }, []);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem('cookie_ok') === '1';
      setShowCookie(!accepted);
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFilesConvertedCount((v) => v + Math.floor(Math.random() * 3));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('recent_jobs', JSON.stringify(recentJobs.slice(0, 12)));
    } catch {}
  }, [recentJobs]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.15 });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    if (path === '/pricing') setView('pricing');
    else setView('home');
    track('page_view', { path });
  }, [path]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang');
      if (stored && translations[stored]) {
        setLang(stored);
        return;
      }
    } catch {}
    const browserLang = navigator.language.split('-')[0];
    const targetLang = translations[browserLang] ? browserLang : defaultLang;
    setLang(targetLang);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const autoPick = params.get('autopick') === '1';
    if (toolParam && toolIds.has(toolParam)) {
      selectTool(toolParam);
      if (autoPick) setPendingOpenToolId(toolParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toolIds]);

  useEffect(() => {
    if (!pendingOpenToolId) return;
    if (pendingOpenToolId !== activeTab) return;
    scrollToConverter();
    openFilePicker();
    setPendingOpenToolId(null);
  }, [pendingOpenToolId, activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser({ name: u.displayName || u.email?.split('@')[0] || 'User', email: u.email, photo: u.photoURL, isAnon: u.isAnonymous });
        const created = new Date(u.metadata.creationTime).getTime();
        const now = Date.now();
        const daysSince = (now - created) / (1000 * 60 * 60 * 24);
        setIsPro(daysSince < 90);

        if (u.isAnonymous) {
          setTwofaVerified(true);
          setShowTwofaModal(false);
          return;
        }

        const token = localStorage.getItem('twofa_token');
        if (token) {
          try {
            const r = await fetch(`${API_BASE}/auth/2fa/verify-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: u.email, token })
            });
            const j = await r.json();
            if (r.ok && j.ok) {
              setTwofaVerified(true);
              setShowTwofaModal(false);
              return;
            }
          } catch {}
        }

        setTwofaVerified(false);
        setShowTwofaModal(true);
      } else {
        setUser(null);
        setIsPro(false);
        setTwofaVerified(false);
      }
    });

    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) setIsLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const changeLanguage = (code) => {
    setLang(code);
    try { localStorage.setItem('lang', code); } catch {}
    setIsLangMenuOpen(false);
  };

  const handleLogin = async (providerName) => {
    setAuthError('');
    try {
      let provider;
      if (providerName === 'google') provider = new GoogleAuthProvider();
      if (providerName === 'github') provider = new GithubAuthProvider();
      if (provider) await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleGuest = async () => {
    try {
      await signInAnonymously(auth);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleExportData = () => {
    setAccountNotice('Export request queued. You will receive a link by email.');
  };

  const handleDeleteAccount = () => {
    setAccountNotice('Account deletion request received. This is a demo action.');
  };

  const startTwoFA = async () => {
    if (!user?.email) return;
    setTwofaStatus('sending');
    setTwofaError('');
    try {
      const r = await fetch(`${API_BASE}/auth/2fa/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setTwofaStatus('sent');
    } catch (e) {
      setTwofaStatus('error');
      setTwofaError(e.message);
    }
  };

  const verifyTwoFA = async () => {
    if (!user?.email) return;
    setTwofaStatus('verifying');
    setTwofaError('');
    try {
      const r = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: twofaCode })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Invalid');
      localStorage.setItem('twofa_token', j.token);
      setTwofaVerified(true);
      setShowTwofaModal(false);
      setTwofaStatus('done');
    } catch (e) {
      setTwofaStatus('error');
      setTwofaError(t.twofaError);
    }
  };

  const reset = () => {
    setFile(null); setFiles([]); setStatus('idle'); setProgress(0); setDownloadUrl(null); setEtaSeconds(null); setSmartSuggestion(null);
  };

  const selectTool = (toolId) => {
    setActiveTab(toolId);
    reset();
  };

  const handleProcess = async () => {
    if (user && !twofaVerified && !user.isAnon) { setShowTwofaModal(true); return; }
    if (!file && files.length === 0) { scrollToConverter(); openFilePicker(); return; }
    setStatus('processing'); setProgress(10);

    try {
      const fd = new FormData();
      const uploadFiles = batchMode ? files : (file ? [file] : []);
      uploadFiles.forEach((f) => fd.append('files', f));
      fd.append('tool', activeTab);
      fd.append('batch', batchMode ? 'true' : 'false');
      fd.append('settings', JSON.stringify(settings));

      jobStartRef.current = Date.now();
      track('job_start', { tool: activeTab, batch: batchMode, count: uploadFiles.length });

      const res = await fetch(`${API_BASE}/jobs`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');

      const poll = async () => {
        const r = await fetch(`${API_BASE}/jobs/${data.jobId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to check job');
        const prog = j.progress || 0;
        setProgress(prog);
        if (prog > 0 && jobStartRef.current) {
          const elapsed = Date.now() - jobStartRef.current;
          const remaining = Math.max(0, Math.round((elapsed * (100 - prog)) / prog));
          setEtaSeconds(Math.round(remaining / 1000));
        }
        if (j.status === 'completed') {
          const dl = j.downloadUrl || '';
          const normalized = dl.startsWith('http') ? dl : `${API_BASE}${dl}`;
          setDownloadUrl(normalized);
          setStatus('done');
          const durationMs = jobStartRef.current ? (Date.now() - jobStartRef.current) : null;
          track('job_complete', { tool: activeTab, jobId: data.jobId, durationMs });
          setRecentJobs((prev) => [
            { id: data.jobId, tool: activeTab, name: batchMode ? `${files.length} files` : (file?.name || 'file'), ts: Date.now() },
            ...prev
          ].slice(0, 12));
          return;
        }
        if (j.status === 'failed') {
          setStatus('error');
          track('job_failed', { tool: activeTab, jobId: data.jobId });
          return;
        }
        setTimeout(poll, 1200);
      };
      poll();
    } catch (e) {
      setStatus('error');
    }
  };

  const download = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    const fileName = (() => {
      try {
        const u = new URL(downloadUrl);
        const parts = u.pathname.split('/');
        return parts[parts.length - 1] || `converted_${Date.now()}`;
      } catch {
        return `converted_${Date.now()}`;
      }
    })();
    a.download = fileName;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-lg border-b px-4 h-20 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => navigate('/')}>
          <Zap className="text-blue-600" /> MegaConvert
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => { if (path !== '/') navigate('/'); setTimeout(scrollToFormats, 50); }} className="font-medium hover:text-blue-600">{t.navTools}</button>
          <button onClick={() => { if (path !== '/') navigate('/'); setTimeout(() => scrollToId('security'), 50); }} className="font-medium hover:text-blue-600">Security</button>
          <button onClick={() => { if (path !== '/') navigate('/'); setTimeout(() => scrollToId('teams'), 50); }} className="font-medium hover:text-blue-600">Teams</button>
          <button onClick={() => { if (path !== '/') navigate('/'); setTimeout(() => scrollToId('status'), 50); }} className="font-medium hover:text-blue-600">Status</button>
          <button onClick={() => navigate('/pricing')} className="font-medium hover:text-blue-600">{t.navPricing}</button>
          <div className="relative" ref={langMenuRef}>
            <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-1 font-medium hover:text-blue-600">
              {LANGUAGES.find(l => l.code === lang)?.flag} <ChevronDown size={14} />
            </button>
            {isLangMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white shadow-xl rounded-xl border py-2">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => changeLanguage(l.code)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex gap-2">
                    {l.flag} {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!user ? (
            <Button onClick={() => setShowAuthModal(true)}>{t.navLogin}</Button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block text-sm">
                <div className="font-bold">{user.name}</div>
                {isPro && <div className="text-amber-600 text-xs font-bold flex justify-end items-center gap-1"><Crown size={10}/> PRO</div>}
              </div>
              <button onClick={() => { localStorage.removeItem('twofa_token'); signOut(auth); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
          )}
        </div>
      </nav>

      {path.startsWith('/convert/') ? (
        <SeoPage
          slug={path.replace('/convert/', '')}
          onSelectTool={selectTool}
          onNavigate={navigate}
        />
      ) : (
        <>
          <input
            type="file"
            ref={fileInputRef}
            data-testid="file-input"
            onChange={e => {
              handleFilesSelected(e.target.files);
            }}
            className="hidden"
            accept={currentTool.accept}
            multiple={batchMode}
          />

          <div className="pt-28 pb-16 px-4 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-200 rounded-full blur-3xl opacity-60" />
            <div className="absolute -bottom-16 -left-24 w-80 h-80 bg-gradient-to-br from-amber-100 via-rose-100 to-pink-100 rounded-full blur-3xl opacity-60" />
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center relative">
              <div className="relative z-10 reveal" data-reveal>
                <Badge color="purple">Global file converter</Badge>
                <h1 className="text-5xl md:text-6xl font-extrabold mt-6 text-slate-900 tracking-tight font-display">{t.heroTitle}</h1>
                <p className="text-lg md:text-xl text-slate-600 mt-5 max-w-xl">{t.heroDesc}</p>
                <div className="flex flex-wrap gap-3 mt-8">
                  <Button size="large" onClick={() => { scrollToConverter(); openFilePicker(); }} data-testid="cta-upload">{t.btnStart}</Button>
                  <Button size="large" variant="secondary" onClick={scrollToFormats}>{t.navTools}</Button>
                </div>
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">★</span>
                    <span><span className="font-semibold">{filesConvertedCount.toLocaleString()}</span> files converted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe2 size={16} className="text-slate-500" />
                    <span>Used in 120+ countries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-slate-500" />
                    <span>100% private</span>
                  </div>
                </div>
                <div className="mt-8">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Top conversions</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {topTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => { selectTool(tool.id); setPendingOpenToolId(tool.id); }}
                        data-testid={`top-tool-${tool.id}`}
                        className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50"
                      >
                        {tool.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative z-10 space-y-6" id="converter">
                <div data-reveal className="reveal">
                  <ProcessDemo />
                </div>
                <div data-reveal className="reveal">
                  <GlassCard>
                  {status === 'idle' && (
                    <div className="w-full flex flex-col items-center py-10" onDragOver={e => e.preventDefault()} onDrop={e => {
                      e.preventDefault();
                      handleFilesSelected(e.dataTransfer.files);
                    }}>
                      {file ? (
                        <div className="mb-6 text-center w-full">
                          <div className="font-bold text-lg mb-2" data-testid="selected-file-name">
                            {batchMode ? `${files.length} files` : file.name}
                          </div>
                          {smartSuggestion && smartSuggestion !== activeTab && (
                            <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-600">
                              <span>Auto-detected format. Suggested:</span>
                              <button
                                onClick={() => selectTool(smartSuggestion)}
                                className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                              >
                                {tools.find((t) => t.id === smartSuggestion)?.name || 'Suggested'}
                              </button>
                            </div>
                          )}

                          {currentTool.type === 'image' && (
                            <div className="grid grid-cols-2 gap-3 text-left text-sm mb-4">
                              <label className="flex flex-col gap-1">
                                <span>Quality (1-100)</span>
                                <input type="number" min="1" max="100" value={settings.image.quality} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, quality: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>DPI</span>
                                <input type="number" value={settings.image.dpi} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, dpi: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Resize (e.g. 1200x1200)</span>
                                <input type="text" value={settings.image.resize} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, resize: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Crop (e.g. 800x800+0+0)</span>
                                <input type="text" value={settings.image.crop} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, crop: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                            </div>
                          )}

                          {currentTool.type === 'video' && (
                            <div className="grid grid-cols-2 gap-3 text-left text-sm mb-4">
                              <label className="flex flex-col gap-1">
                                <span>Resolution</span>
                                <select value={settings.video.resolution} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, resolution: e.target.value } }))} className="border rounded-lg px-3 py-2">
                                  <option value="480p">480p</option>
                                  <option value="720p">720p</option>
                                  <option value="1080p">1080p</option>
                                  <option value="4k">4K</option>
                                </select>
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>FPS</span>
                                <input type="number" value={settings.video.fps} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, fps: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Bitrate (e.g. 2M)</span>
                                <input type="text" value={settings.video.bitrate} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, bitrate: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Codec</span>
                                <select value={settings.video.codec} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, codec: e.target.value } }))} className="border rounded-lg px-3 py-2">
                                  <option value="h264">H264</option>
                                  <option value="h265">H265</option>
                                  <option value="av1">AV1</option>
                                </select>
                              </label>
                            </div>
                          )}

                          {currentTool.type === 'audio' && (
                            <div className="grid grid-cols-2 gap-3 text-left text-sm mb-4">
                              <label className="flex flex-col gap-1">
                                <span>Bitrate (e.g. 192k)</span>
                                <input type="text" value={settings.audio.bitrate} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, bitrate: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Channels</span>
                                <input type="number" value={settings.audio.channels} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, channels: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Trim start (sec)</span>
                                <input type="number" value={settings.audio.trimStart} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, trimStart: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span>Trim duration (sec)</span>
                                <input type="number" value={settings.audio.trimDuration} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, trimDuration: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                              </label>
                              <label className="flex items-center gap-2 col-span-2">
                                <input type="checkbox" checked={settings.audio.normalize} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, normalize: e.target.checked } }))} />
                                <span>Normalize</span>
                              </label>
                            </div>
                          )}

                          <Button size="large" onClick={handleProcess} data-testid="convert-button">{t.btnConvert}</Button>
                        </div>
                      ) : (
                        <>
                          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-600">
                            {currentTool.icon}
                          </div>
                          <h3 className="text-2xl font-bold text-slate-800 mb-4">{t.btnSelect}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                            <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} />
                            <span>{t.batch}</span>
                          </div>
                          <Button size="large" onClick={() => { scrollToConverter(); openFilePicker(); }} data-testid="start-button">{t.btnStart}</Button>
                        </>
                      )}
                    </div>
                  )}

                  {status === 'processing' && (
                    <div className="text-center py-10">
                      <div className="text-3xl font-bold text-blue-600 mb-4">{Math.round(progress)}%</div>
                      <div className="h-2.5 w-72 bg-slate-100 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all animate-pulse-soft" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="mt-4 text-slate-500 text-sm">{t.processing}</div>
                      {etaSeconds !== null && (
                        <div className="mt-2 text-xs text-slate-500">ETA ~ {etaSeconds}s</div>
                      )}
                    </div>
                  )}

                  {status === 'done' && (
                    <div className="text-center py-10">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                        <CheckCircle2 size={40} />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">{t.done}</h3>
                      <div className="text-sm text-slate-500 mb-6">File ready. Convert another?</div>
                      <div className="flex gap-4 justify-center">
                        <Button variant="secondary" onClick={reset}>{t.back}</Button>
                        <Button variant="primary" onClick={download}>{t.download}</Button>
                      </div>
                    </div>
                  )}
                  </GlassCard>
                </div>
              </div>
            </div>
          </div>

          {user && (
            <Section id="dashboard" className="border-t border-slate-200 reveal" data-reveal>
              <div className="text-center mb-10">
                <Badge color="green">Dashboard</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mt-4">Your workspace</h2>
                <p className="text-slate-500 mt-3">History, favorites, and quick actions.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><Activity size={16} /> Recent conversions</div>
                  {recentJobs.length === 0 ? (
                    <div className="text-sm text-slate-500">No jobs yet. Convert a file to see history.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentJobs.slice(0, 5).map((job) => (
                        <div key={job.id} className="flex items-center justify-between text-sm">
                          <div className="font-medium">{tools.find((t) => t.id === job.tool)?.name || job.tool}</div>
                          <div className="text-slate-500">{new Date(job.ts).toLocaleTimeString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><Users2 size={16} /> For Teams (preview)</div>
                  <ul className="text-sm text-slate-600 space-y-2">
                    <li>Batch processing and shared queues</li>
                    <li>Shared workspace and approvals</li>
                    <li>API access and audit logs</li>
                  </ul>
                  <Button variant="secondary" className="mt-4 w-full">Request access</Button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><ServerCog size={16} /> Storage usage</div>
                  <div className="text-sm text-slate-500 mb-2">2.3 GB of 20 GB</div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: '12%' }} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={handleExportData}>Export data</Button>
                    <Button variant="outline" className="flex-1" onClick={handleDeleteAccount}>Delete account</Button>
                  </div>
                  {accountNotice && <div className="text-xs text-slate-500 mt-3">{accountNotice}</div>}
                </div>
              </div>
            </Section>
          )}

          <Section id="formats" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="blue">Formats</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Pick your conversion</h2>
              <p className="text-slate-500 mt-3">Search, filter, and start converting in seconds.</p>
            </div>

            <div className="max-w-3xl mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search format (e.g. pdf, mp3, heic)"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <Button variant="secondary" onClick={() => { setSearchTerm(''); setActiveCategory('all'); }}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActiveCategory(c.id); setShowAllFormats(true); }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${activeCategory === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => { selectTool(tool.id); setPendingOpenToolId(tool.id); }}
                  data-testid={`format-card-${tool.id}`}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:bg-slate-50 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    {tool.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{tool.name}</div>
                    <div className="text-xs text-slate-500">{tool.type.toUpperCase()}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              ))}
            </div>
            {filteredTools.length === 0 && (
              <div className="text-center text-slate-500 mt-8">No formats found. Try another keyword.</div>
            )}
            {filteredTools.length > 12 && (
              <div className="text-center mt-10">
                <Button variant="secondary" onClick={() => setShowAllFormats((v) => !v)}>
                  {showAll ? 'Show fewer formats' : 'Show all formats'}
                </Button>
              </div>
            )}
          </Section>

          {recentJobs.length > 0 && (
            <Section id="recent" className="border-t border-slate-200 reveal" data-reveal>
              <div className="text-center mb-10">
                <Badge color="amber">Recently used</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mt-4">Pick up where you left off</h2>
                <p className="text-slate-500 mt-3">Re-run your most recent conversions in one click.</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {recentJobs.slice(0, 6).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => { selectTool(job.tool); scrollToConverter(); }}
                    className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-sm"
                  >
                    {tools.find((t) => t.id === job.tool)?.name || job.tool}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section id="security" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="green">Security & Privacy</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Your files stay private</h2>
              <p className="text-slate-500 mt-3">Built for privacy-first conversion.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <ShieldCheck className="text-emerald-600 mb-4" />
                <div className="font-semibold mb-2">Auto deletion in 24h</div>
                <div className="text-sm text-slate-500">Temporary files are automatically removed after processing.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Lock className="text-emerald-600 mb-4" />
                <div className="font-semibold mb-2">Encrypted transfers</div>
                <div className="text-sm text-slate-500">All uploads and downloads use secure HTTPS.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Users2 className="text-emerald-600 mb-4" />
                <div className="font-semibold mb-2">No manual access</div>
                <div className="text-sm text-slate-500">Files are processed automatically with no human review.</div>
              </div>
            </div>
          </Section>

          <Section id="performance" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="blue">Performance</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Fast by design</h2>
              <p className="text-slate-500 mt-3">Optimized for speed and reliability.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Globe2 className="text-blue-600 mb-4" />
                <div className="font-semibold mb-2">Powered by global CDN</div>
                <div className="text-sm text-slate-500">Low latency uploads and downloads worldwide.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <ServerCog className="text-blue-600 mb-4" />
                <div className="font-semibold mb-2">Edge processing</div>
                <div className="text-sm text-slate-500">Jobs are routed to the closest available worker.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Activity className="text-blue-600 mb-4" />
                <div className="font-semibold mb-2">Optimized for speed</div>
                <div className="text-sm text-slate-500">Parallel queues keep conversions moving fast.</div>
              </div>
            </div>
          </Section>

          <Section id="teams" className="border-t border-slate-200 reveal" data-reveal>
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge color="purple">For Teams</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mt-4">MegaConvert for Teams</h2>
                <p className="text-slate-500 mt-3">Batch processing, shared workspaces, and API access.</p>
                <div className="mt-6 flex gap-3">
                  <Button variant="primary">Join waitlist</Button>
                  <Button variant="secondary">See API docs</Button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Users2 size={18} /></div>
                    <div>
                      <div className="font-semibold">Shared workspace</div>
                      <div className="text-sm text-slate-500">Collaborate with your team in one place.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Cpu size={18} /></div>
                    <div>
                      <div className="font-semibold">API access</div>
                      <div className="text-sm text-slate-500">Automate conversions with simple endpoints.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Clock3 size={18} /></div>
                    <div>
                      <div className="font-semibold">Queue priorities</div>
                      <div className="text-sm text-slate-500">Faster execution for critical jobs.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section id="tech" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="purple">Credibility</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Built with modern edge architecture</h2>
              <p className="text-slate-500 mt-3">Powered by FFmpeg, LibreOffice, and high-performance queues.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Cpu className="text-slate-700 mb-4" />
                <div className="font-semibold mb-2">Global infrastructure</div>
                <div className="text-sm text-slate-500">Distributed workers keep latency low.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <ServerCog className="text-slate-700 mb-4" />
                <div className="font-semibold mb-2">FFmpeg & LibreOffice</div>
                <div className="text-sm text-slate-500">Industry-standard conversion engine.</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <Activity className="text-slate-700 mb-4" />
                <div className="font-semibold mb-2">Optimized pipelines</div>
                <div className="text-sm text-slate-500">Parallelized, fault-tolerant processing.</div>
              </div>
            </div>
          </Section>

          <Section id="transparency" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="amber">Transparency Report</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Trust through visibility</h2>
              <p className="text-slate-500 mt-3">We publish how we process and delete files.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
                <div className="text-3xl font-bold text-slate-900">1.2M+</div>
                <div className="text-sm text-slate-500 mt-2">files processed</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
                <div className="text-3xl font-bold text-slate-900">24h</div>
                <div className="text-sm text-slate-500 mt-2">auto deletion window</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
                <div className="text-3xl font-bold text-slate-900">0</div>
                <div className="text-sm text-slate-500 mt-2">manual file reviews</div>
              </div>
            </div>
          </Section>

          <Section id="status" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="green">Status</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">All systems operational</h2>
              <p className="text-slate-500 mt-3">Status page: status.megaconvert.com</p>
            </div>
            <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">API, Workers, Storage</div>
                <div className="text-emerald-600 font-semibold">Operational</div>
              </div>
            </div>
          </Section>

          <Section id="support" className="border-t border-slate-200 reveal" data-reveal>
            <div className="text-center mb-10">
              <Badge color="purple">Support</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-4">Compliance & reporting</h2>
              <p className="text-slate-500 mt-3">DMCA and abuse reporting forms.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <form className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); alert('DMCA request submitted (demo).'); }}>
                <div className="font-semibold mb-3">DMCA Request</div>
                <input className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="Your email" required />
                <input className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="Infringing URL" required />
                <textarea className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="Details" rows="3" required></textarea>
                <Button className="w-full">Submit DMCA</Button>
              </form>
              <form className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); alert('Abuse report submitted (demo).'); }}>
                <div className="font-semibold mb-3">Abuse Report</div>
                <input className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="Your email" required />
                <input className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="Incident URL" required />
                <textarea className="w-full border rounded-xl px-4 py-2 mb-3" placeholder="What happened?" rows="3" required></textarea>
                <Button className="w-full">Report abuse</Button>
              </form>
            </div>
          </Section>
        </>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400"><X /></button>
            <h3 className="text-2xl font-bold text-center mb-6">{authMode === 'login' ? t.loginTitle : t.registerTitle}</h3>
            <div className="space-y-3">
              <button onClick={() => handleLogin('google')} className="w-full py-2.5 border rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 font-medium">
                Google {t.authGoogle}
              </button>
              <button onClick={() => handleLogin('github')} className="w-full py-2.5 bg-[#24292e] text-white rounded-xl flex justify-center items-center gap-2 hover:bg-[#2b3137]">
                <Github size={20} /> {t.authGithub}
              </button>
              <div className="text-center text-xs text-slate-400 my-2">{t.authOr}</div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="email" placeholder="Email" required className="w-full pl-10 pr-4 py-2 border rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="password" placeholder="Password" required className="w-full pl-10 pr-4 py-2 border rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
                <Button className="w-full justify-center">{t.authEmail}</Button>
              </form>
              <button onClick={handleGuest} className="w-full text-sm text-slate-500 hover:text-slate-800">{t.authGuest}</button>
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm text-blue-600 font-medium">
                {authMode === 'login' ? t.authSwitchRegister : t.authSwitchLogin}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTwofaModal && user && !user.isAnon && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowTwofaModal(false)} className="absolute top-4 right-4 text-slate-400"><X /></button>
            <h3 className="text-2xl font-bold text-center mb-3">{t.twofaTitle}</h3>
            <p className="text-sm text-slate-500 text-center mb-6">{t.twofaDesc}</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="123456"
                className="w-full px-4 py-2 border rounded-xl"
                value={twofaCode}
                onChange={(e) => setTwofaCode(e.target.value)}
              />
              {twofaError && <p className="text-xs text-red-500 text-center">{twofaError}</p>}
              <Button className="w-full" onClick={verifyTwoFA}>{t.twofaVerify}</Button>
              <Button variant="secondary" className="w-full" onClick={startTwoFA}>
                {twofaStatus === 'sending' ? t.processing : t.twofaSend}
              </Button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-300 py-14 mt-auto">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-5 gap-8 text-sm">
          <div>
            <div className="font-bold text-white mb-3 flex items-center gap-2"><Zap size={16} /> MegaConvert</div>
            <div className="text-slate-400">Fast, private, and reliable file conversion.</div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Product</div>
            <div className="space-y-2">
              <button onClick={() => scrollToId('converter')} className="block hover:text-white">Convert</button>
              <button onClick={() => navigate('/pricing')} className="block hover:text-white">Pricing</button>
              <button onClick={() => scrollToId('teams')} className="block hover:text-white">API</button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Company</div>
            <div className="space-y-2">
              <button onClick={() => scrollToId('transparency')} className="block hover:text-white">About</button>
              <div>Careers</div>
              <div>Blog</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Legal</div>
            <div className="space-y-2">
              <button onClick={() => scrollToId('security')} className="block hover:text-white">Privacy</button>
              <div>Terms</div>
              <button onClick={() => scrollToId('support')} className="block hover:text-white">DMCA</button>
              <button onClick={() => scrollToId('security')} className="block hover:text-white">Security</button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Support</div>
            <div className="space-y-2">
              <div>Help center</div>
              <div>Contact</div>
              <button onClick={() => scrollToId('status')} className="block hover:text-white">Status</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-10 text-xs text-slate-500">
          &copy; 2026 MegaConvert. All rights reserved.
        </div>
      </footer>

      {showCookie && (
        <div className="fixed bottom-4 left-4 right-4 z-[80] bg-white border border-slate-200 shadow-lg rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">
            We use cookies to improve your experience. By using MegaConvert you agree to our cookie policy.
          </div>
          <Button onClick={() => { setShowCookie(false); try { localStorage.setItem('cookie_ok', '1'); } catch {} }}>Accept</Button>
        </div>
      )}

      <span className="sr-only" data-testid="active-tool">{activeTab}</span>
    </div>
  );
}













