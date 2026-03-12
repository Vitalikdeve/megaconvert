import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  CheckCircle2, Zap, ShieldCheck, Globe2, ServerCog, Users2, Activity, Clock3, Cpu, Sparkles,
  Image as ImageIcon, FileText, Music, Video,
  ChevronRight, ChevronDown, Crown, Box, Mail, Github, Lock, X, ArrowRight, Download, RefreshCw
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

// --- Hooks ---
const useMousePosition = (ref) => {
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ref.current.style.setProperty('--mouse-x', `${x}px`);
        ref.current.style.setProperty('--mouse-y', `${y}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [ref]);
};

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

// --- Components ---

const PremiumGlassCard = ({ children, className = "" }) => {
  const cardRef = useRef(null);
  useMousePosition(cardRef);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`glass-pro-card hover-glow ${className}`}
    >
      <div className="relative z-10 p-6 md:p-10">
        {children}
      </div>
    </motion.div>
  );
};

const FadeIn = ({ children, delay = 0, direction = "up" }) => (
  <motion.div
    initial={{ opacity: 0, y: direction === "up" ? 20 : -20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
  >
    {children}
  </motion.div>
);

const GlassCard = ({ children }) => (
  <div className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-2 relative overflow-hidden">
    <div className="bg-slate-900/40 rounded-3xl p-8 md:p-12 border border-white/5 min-h-[400px] flex flex-col items-center justify-center transition-all">
      {children}
    </div>
  </div>
);

const ProcessDemo = () => (
  <PremiumGlassCard className="border-blue-500/20">
    <div className="flex items-center justify-between text-sm text-slate-400 mb-6">
      <span className="font-semibold text-white flex items-center gap-2"><Sparkles size={16} className="text-blue-400" /> Live processing engine</span>
      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">v2.4 Stable</span>
    </div>
    <div className="space-y-4">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.98, 1, 0.98] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shadow-lg shadow-blue-500/20">PDF</div>
        <div className="flex-1">
          <div className="font-semibold text-white text-sm">invoice_2026.pdf</div>
          <div className="text-xs text-slate-500">2.4 MB • Waiting for cloud queue</div>
        </div>
      </motion.div>

      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-white">Converting to DOCX</span>
          <span className="text-blue-400 font-mono">84%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "84%" }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0.5 }}
        whileInView={{ opacity: 1 }}
        className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
      >
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 size={20} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-emerald-400 text-sm">Process complete</div>
          <div className="text-xs text-emerald-500/70">Cleaned & Optimized</div>
        </div>
      </motion.div>
    </div>
  </PremiumGlassCard>
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

const Page = ({ title, subtitle, actions, children }) => (
  <div className="pt-32 pb-20 px-4">
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold">{title}</h1>
        {subtitle && <p className="text-slate-600 text-lg mt-4">{subtitle}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  </div>
);

const PageCard = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm ${className}`}>{children}</div>
);

const BLOG_POSTS = [
  { title: 'How we keep conversions private', desc: 'Security controls, temporary storage, and zero-access processing.', date: 'Feb 10, 2026' },
  { title: 'PDF to Word quality guide', desc: 'Best practices to preserve layout and fonts.', date: 'Feb 02, 2026' },
  { title: 'Video compression without losing quality', desc: 'Recommended presets for fast, clean output.', date: 'Jan 28, 2026' },
  { title: 'OCR accuracy tips', desc: 'Improve recognition for scans and photos.', date: 'Jan 19, 2026' },
  { title: 'Batch conversion workflows', desc: 'Save hours with queued processing and bundles.', date: 'Jan 11, 2026' },
  { title: 'Enterprise readiness checklist', desc: 'Policies, audit logs, and SLA basics.', date: 'Jan 03, 2026' }
];

const FAQ_ITEMS = [
  { q: 'Is MegaConvert free?', a: 'Yes. Core conversions are free with optional PRO upgrades.' },
  { q: 'How long are files stored?', a: 'Files are auto-deleted after 24 hours by default.' },
  { q: 'Do you read or review my files?', a: 'No. Files are processed automatically with no manual access.' },
  { q: 'What is the maximum file size?', a: 'Up to 1 GB per file on the current plan.' },
  { q: 'Do you support batch conversion?', a: 'Yes. Upload multiple files and receive a zipped output.' },
  { q: 'Is my data encrypted?', a: 'Yes. Transfers are encrypted in transit and storage is protected.' },
  { q: 'Which formats are supported?', a: 'Documents, images, audio, video, and archives. See /convert and tools list.' },
  { q: 'Why did my conversion fail?', a: 'Common causes are corrupted files or unsupported content. Retry or choose another tool.' },
  { q: 'Can I convert scanned PDFs to text?', a: 'Yes. Use OCR to extract text from images or scans.' },
  { q: 'Do you keep backups of my files?', a: 'Backups are encrypted and short-lived for operational stability.' },
  { q: 'Can I delete my account?', a: 'Yes. Use the dashboard deletion request.' },
  { q: 'How do I export my data?', a: 'Use the dashboard export option and a link is emailed.' },
  { q: 'Where are your servers located?', a: 'We use global infrastructure to minimize latency.' },
  { q: 'Do you offer an API?', a: 'Yes. API access is available for teams and enterprise.' },
  { q: 'Is there a usage limit?', a: 'Fair use applies. Heavy usage may require a PRO plan.' },
  { q: 'Can I convert CAD files?', a: 'Yes. DXF and DWG are supported for PDF export.' },
  { q: 'Why is OCR accuracy low?', a: 'Blurry images reduce accuracy. Use higher resolution scans.' },
  { q: 'Do you support HEIC and AVIF?', a: 'Yes. Convert HEIC or AVIF to JPG/PNG.' },
  { q: 'Can I compress PDFs?', a: 'Yes. Use Compress PDF for smaller file sizes.' },
  { q: 'Are conversions deterministic?', a: 'Yes. The pipeline is designed for consistent output.' },
  { q: 'Do you log conversions?', a: 'We log metadata for reliability and debugging, not file content.' },
  { q: 'Do you provide an SLA?', a: 'Yes for enterprise. Contact us for details.' },
  { q: 'Is there a status page?', a: 'Yes. Check status.megaconvert.com for uptime.' },
  { q: 'Can I use the service commercially?', a: 'Yes, as long as files are legal and rights are respected.' },
  { q: 'How do I report abuse?', a: 'Use the DMCA and abuse reporting forms in Support.' }
];

const MilkaPaw = ({ isVisible }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -20, y: 20 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, rotate: 20, y: 20 }}
        className="fixed bottom-8 right-8 z-[100] pointer-events-none hidden md:block"
      >
        <div className="relative">
          <div className="absolute -top-12 -left-12 bg-white text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-xl border border-slate-200 whitespace-nowrap">
            Meow! Ready to convert? 🐾
          </div>
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 bg-[#fef3c7] rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-3xl"
          >
            🐾
          </motion.div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [showMilka, setShowMilka] = useState(false);
  const [lang, setLang] = useState(defaultLang);
  const t = { ...translations.en, ...(translations[lang] || {}) };

  const [path, setPath] = useState(() => window.location.pathname);
  const [errorInfo, setErrorInfo] = useState(null);
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
    track('page_view', { path });
    if (path === '/login') setShowAuthModal(true);
  }, [path]);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    setFile(null); setFiles([]); setStatus('idle'); setProgress(0); setDownloadUrl(null); setEtaSeconds(null); setSmartSuggestion(null); setErrorInfo(null);
  };

  const selectTool = (toolId) => {
    setActiveTab(toolId);
    reset();
  };

  const handleProcess = async () => {
    if (user && !twofaVerified && !user.isAnon) { setShowTwofaModal(true); return; }
    if (!file && files.length === 0) { scrollToConverter(); openFilePicker(); return; }
    setStatus('processing'); setProgress(10); setErrorInfo(null);

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
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to create job');

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
          setErrorInfo(j.error?.message || 'Conversion failed. Try again.');
          track('job_failed', { tool: activeTab, jobId: data.jobId, error: j.error?.code || null });
          return;
        }
        setTimeout(poll, 1200);
      };
      poll();
    } catch (e) {
      setStatus('error');
      setErrorInfo(e.message || 'Conversion failed. Try again.');
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

  const isHome = path === '/' || path === '';
  const isPricing = path === '/pricing';
  const isLogin = path === '/login';
  const isDashboard = path === '/dashboard';
  const isBlog = path === '/blog';
  const isFaq = path === '/faq';
  const isPrivacy = path === '/privacy';
  const isTerms = path === '/terms';
  const isLegal = path === '/legal';
  const isAbout = path === '/about';
  const isContact = path === '/contact';
  const isConvert = path.startsWith('/convert/');
  const isNotFound = !isHome && !isPricing && !isLogin && !isDashboard && !isBlog && !isFaq && !isPrivacy && !isTerms && !isLegal && !isAbout && !isContact && !isConvert;

  const renderPricingPage = () => (
    <Page
      title="Pricing"
      subtitle="Clear plans for individuals, teams, and enterprise."
      actions={(
        <>
          <Button onClick={() => navigate('/')}>Start converting</Button>
          <Button variant="secondary" onClick={() => scrollToId('teams')}>See team features</Button>
        </>
      )}
    >
      <div className="grid md:grid-cols-3 gap-6">
        <PageCard>
          <div className="text-sm uppercase tracking-widest text-slate-500">Free</div>
          <div className="text-3xl font-bold mt-2">$0</div>
          <div className="text-slate-500 mt-2">For personal use and quick tasks.</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>Standard conversions</div>
            <div>Batch mode</div>
            <div>24h auto deletion</div>
          </div>
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>Get started</Button>
        </PageCard>
        <PageCard className="border-2 border-blue-500">
          <div className="text-sm uppercase tracking-widest text-blue-600">Pro</div>
          <div className="text-3xl font-bold mt-2">$12</div>
          <div className="text-slate-500 mt-2">For professionals and creators.</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>Priority queue</div>
            <div>Advanced settings</div>
            <div>Extended history</div>
          </div>
          <Button className="mt-6 w-full" variant="primary">Upgrade to Pro</Button>
        </PageCard>
        <PageCard>
          <div className="text-sm uppercase tracking-widest text-slate-500">Enterprise</div>
          <div className="text-3xl font-bold mt-2">Custom</div>
          <div className="text-slate-500 mt-2">Security, SLA, and audit logs.</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>Dedicated workers</div>
            <div>Custom limits</div>
            <div>Compliance packages</div>
          </div>
          <Button className="mt-6 w-full" variant="secondary" onClick={() => navigate('/contact')}>Contact sales</Button>
        </PageCard>
      </div>
    </Page>
  );

  const renderLoginPage = () => (
    <Page
      title="Sign in"
      subtitle="Access your workspace and conversion history."
      actions={(
        <>
          <Button onClick={() => setShowAuthModal(true)}>Open sign in</Button>
          <Button variant="secondary" onClick={handleGuest}>Continue as guest</Button>
        </>
      )}
    >
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">Why sign in</div>
          <div className="text-sm text-slate-600">Save recent jobs, enable 2FA, and access team features.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Security</div>
          <div className="text-sm text-slate-600">We support two-factor authentication and session controls.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderDashboardPage = () => (
    <Page
      title="Dashboard"
      subtitle="Your workspace, history, and account actions."
      actions={user ? null : <Button onClick={() => navigate('/login')}>Sign in to continue</Button>}
    >
      {!user && (
        <PageCard>
          <div className="font-semibold mb-2">Authentication required</div>
          <div className="text-sm text-slate-600">Sign in to view recent conversions and manage account settings.</div>
        </PageCard>
      )}
      {user && (
        <div className="grid lg:grid-cols-3 gap-6">
          <PageCard>
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><Activity size={16} /> Recent conversions</div>
            {recentJobs.length === 0 ? (
              <div className="text-sm text-slate-500">No jobs yet. Convert a file to see history.</div>
            ) : (
              <div className="space-y-3">
                {recentJobs.slice(0, 8).map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm">
                    <div className="font-medium">{tools.find((t) => t.id === job.tool)?.name || job.tool}</div>
                    <div className="text-slate-500">{new Date(job.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </PageCard>
          <PageCard>
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><ServerCog size={16} /> Account</div>
            <div className="text-sm text-slate-600 mb-4">Signed in as {user.email || user.name}</div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleExportData}>Export data</Button>
              <Button variant="outline" className="flex-1" onClick={handleDeleteAccount}>Delete account</Button>
            </div>
            {accountNotice && <div className="text-xs text-slate-500 mt-3">{accountNotice}</div>}
          </PageCard>
          <PageCard>
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4"><Users2 size={16} /> Teams</div>
            <div className="text-sm text-slate-600">Batch processing, shared workspaces, and API access.</div>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/contact')}>Request access</Button>
          </PageCard>
        </div>
      )}
    </Page>
  );

  const renderBlogPage = () => (
    <Page title="Blog" subtitle="Product updates, guides, and best practices.">
      <div className="grid md:grid-cols-2 gap-6">
        {BLOG_POSTS.map((post) => (
          <PageCard key={post.title}>
            <div className="text-xs uppercase tracking-widest text-slate-500">{post.date}</div>
            <div className="font-semibold text-lg mt-2">{post.title}</div>
            <div className="text-sm text-slate-600 mt-2">{post.desc}</div>
            <Button variant="secondary" className="mt-4">Read more</Button>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderFaqPage = () => (
    <Page title="FAQ" subtitle="Answers to common questions and conversion details.">
      <div className="grid md:grid-cols-2 gap-6">
        {FAQ_ITEMS.map((item) => (
          <PageCard key={item.q}>
            <div className="font-semibold">{item.q}</div>
            <div className="text-sm text-slate-600 mt-2">{item.a}</div>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderPrivacyPage = () => (
    <Page title="Privacy Policy" subtitle="How we collect, process, and protect data.">
      <div className="space-y-6">
        <PageCard>
          <div className="font-semibold mb-2">Data we collect</div>
          <div className="text-sm text-slate-600">Email (if registered), IP address, device metadata, and files uploaded for conversion.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Storage and retention</div>
          <div className="text-sm text-slate-600">Files are automatically deleted after 24 hours. Logs are retained for 90 days. Backups are encrypted.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Data sharing</div>
          <div className="text-sm text-slate-600">We do not sell personal data. We disclose subprocessors such as Stripe, Google, and Cloudflare where applicable.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">User rights</div>
          <div className="text-sm text-slate-600">You can request data export, deletion, and account removal at any time.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Security</div>
          <div className="text-sm text-slate-600">We use HTTPS, encryption at rest, access controls, and signed URLs for files.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderTermsPage = () => (
    <Page title="Terms of Service" subtitle="Service terms, acceptable use, and limitations.">
      <div className="space-y-6">
        <PageCard>
          <div className="font-semibold mb-2">Service provided as is</div>
          <div className="text-sm text-slate-600">We provide the service without warranties and may update features over time.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Prohibited use</div>
          <div className="text-sm text-slate-600">No illegal files, malware, abuse, or copyright violations.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Account actions</div>
          <div className="text-sm text-slate-600">We may suspend accounts for policy violations and security risks.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderLegalPage = () => (
    <Page title="Legal & Compliance" subtitle="Policies, standards, and compliance programs.">
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">Compliance coverage</div>
          <div className="text-sm text-slate-600">GDPR, CCPA, LGPD, PIPEDA, UK GDPR, APPI, and other regional regulations.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Security policy</div>
          <div className="text-sm text-slate-600">HTTPS, HSTS, CSP, WAF, DDoS protection, and encryption at rest.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">DPA and SLA</div>
          <div className="text-sm text-slate-600">Enterprise customers can request Data Processing Agreements and Service Level Agreements.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Cookie policy</div>
          <div className="text-sm text-slate-600">We use cookies to improve experience, analytics, and security.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderAboutPage = () => (
    <Page title="About MegaConvert" subtitle="Convert anything. Anywhere. Instantly.">
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">Mission</div>
          <div className="text-sm text-slate-600">Deliver fast, reliable, and private file conversion for everyone.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Values</div>
          <div className="text-sm text-slate-600">Determinism, stability, predictable resource usage, and transparency.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Roadmap</div>
          <div className="text-sm text-slate-600">Year 1 SEO and product fit. Year 2 Pro and B2B. Year 3 AI and enterprise.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Brand</div>
          <div className="text-sm text-slate-600">Professional, global, and neutral tone for enterprise readiness.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderContactPage = () => (
    <Page title="Contact" subtitle="Sales, support, and compliance requests.">
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-3">General inquiry</div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); alert('Message sent (demo).'); }}>
            <input className="w-full border rounded-xl px-4 py-2" placeholder="Your email" required />
            <input className="w-full border rounded-xl px-4 py-2" placeholder="Subject" required />
            <textarea className="w-full border rounded-xl px-4 py-2" placeholder="Message" rows="4" required></textarea>
            <Button className="w-full">Send</Button>
          </form>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-3">Compliance</div>
          <div className="text-sm text-slate-600">For DPA, SLA, or security reviews, contact legal@megaconvert.com.</div>
          <div className="text-sm text-slate-600 mt-4">For abuse reports, use the DMCA form in Support.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderNotFoundPage = () => (
    <Page title="Page not found" subtitle="The page you requested does not exist.">
      <PageCard>
        <div className="text-sm text-slate-600">Return to the home page or explore conversions.</div>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => navigate('/')}>Go home</Button>
          <Button variant="secondary" onClick={() => navigate('/convert/pdf-to-word')}>Open converter</Button>
        </div>
      </PageCard>
    </Page>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Premium Navbar */}
      <nav className="fixed w-full z-50 bg-[#020617]/40 backdrop-blur-xl border-b border-white/5 px-4 h-20 flex justify-between items-center">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 font-bold text-xl cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap className="text-white fill-white" size={20} />
            </div>
            <span className="tracking-tight font-display">MegaConvert</span>
          </motion.div>

          <div className="hidden lg:flex items-center gap-8">
            {['Tools', 'Security', 'Teams', 'Pricing'].map((item, i) => (
              <motion.button
                key={item}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => {
                  if (item === 'Pricing') navigate('/pricing');
                  else scrollToId(item.toLowerCase());
                }}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                {item}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={langMenuRef}>
              <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-1 font-medium hover:text-blue-400 transition-colors p-2 rounded-lg bg-white/5 border border-white/5">
                {LANGUAGES.find(l => l.code === lang)?.flag} <ChevronDown size={14} className="text-slate-500" />
              </button>
              <AnimatePresence>
                {isLangMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-48 glass-pro rounded-2xl border border-white/10 py-2 shadow-2xl z-50"
                  >
                    {LANGUAGES.map(l => (
                      <button key={l.code} onClick={() => changeLanguage(l.code)} className="w-full text-left px-4 py-2 hover:bg-white/5 flex gap-3 items-center text-sm">
                        <span>{l.flag}</span>
                        <span className="text-slate-300">{l.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {!user ? (
              <Button onClick={() => navigate('/login')} className="!px-5 !py-2.5 !text-xs uppercase tracking-widest">{t.navLogin}</Button>
            ) : (
              <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                <div className="text-right hidden md:block text-sm">
                  <div className="font-bold text-white leading-none mb-1">{user.name}</div>
                  {isPro && <div className="text-amber-500 text-[10px] font-bold uppercase tracking-tighter flex items-center justify-end gap-1"><Crown size={10} fill="currentColor"/> PRO Member</div>}
                </div>
                <button onClick={() => signOut(auth)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {isConvert ? (
          <motion.div key="convert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SeoPage slug={path.replace('/convert/', '')} onSelectTool={selectTool} onNavigate={navigate} />
          </motion.div>
        ) : isPricing ? (
          <motion.div key="pricing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderPricingPage()}
          </motion.div>
        ) : isLogin ? (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderLoginPage()}
          </motion.div>
        ) : (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Hero Section */}
            <div className="relative pt-40 pb-24 overflow-hidden">
              {/* Background Orbs */}
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] -mr-96 -mt-96" />
              <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] -ml-48 -mb-48" />

              <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center relative z-10">
                <div>
                  <FadeIn>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8">
                      <Sparkles size={14} /> Global Transformation Engine
                    </div>
                  </FadeIn>
                  <FadeIn delay={0.1}>
                    <h1 className="text-6xl md:text-7xl font-extrabold text-white tracking-tight font-display leading-[1.1] mb-8">
                      Transform files at <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">Light Speed.</span>
                    </h1>
                  </FadeIn>
                  <FadeIn delay={0.2}>
                    <p className="text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
                      Experience the world's most advanced cloud conversion engine. Secure, private, and breathtakingly fast.
                    </p>
                  </FadeIn>
                  <FadeIn delay={0.3}>
                    <div className="flex flex-wrap gap-4 mb-12">
                      <Button
                        size="large"
                        onClick={() => { scrollToConverter(); openFilePicker(); }}
                        onMouseEnter={() => setShowMilka(true)}
                        onMouseLeave={() => setShowMilka(false)}
                        className="!rounded-2xl !px-10 group"
                      >
                        Start for Free <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <Button size="large" variant="secondary" onClick={scrollToFormats} className="!bg-white/5 !text-white !border-white/10 !rounded-2xl hover:!bg-white/10">
                        Explore Tools
                      </Button>
                    </div>
                  </FadeIn>

                  <FadeIn delay={0.4}>
                    <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/5">
                      <div>
                        <div className="text-2xl font-bold text-white mb-1">1.2M+</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Conversions</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white mb-1">120+</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Countries</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white mb-1">24h</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Auto-Delete</div>
                      </div>
                    </div>
                  </FadeIn>
                </div>

                <div id="converter" className="relative">
                  <AnimatePresence mode="wait">
                    {status === 'idle' ? (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4 }}
                      >
                        <PremiumGlassCard className="!p-1 border-blue-500/20">
                          <div
                            className="w-full flex flex-col items-center py-16 px-6 border-2 border-dashed border-white/10 rounded-[28px] hover:border-blue-500/40 transition-colors group cursor-pointer"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
                            onClick={openFilePicker}
                          >
                            <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFilesSelected(e.target.files)} multiple={batchMode} accept={currentTool.accept} />

                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              className="w-20 h-20 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-8 border border-blue-500/20 shadow-2xl shadow-blue-500/20"
                            >
                              {currentTool.icon}
                            </motion.div>

                            {file ? (
                              <div className="text-center w-full">
                                <h3 className="text-xl font-bold text-white mb-4 truncate max-w-xs mx-auto">
                                  {batchMode ? `${files.length} Files Selected` : file.name}
                                </h3>
                                <div className="flex gap-3 justify-center mb-8">
                                  <Button onClick={(e) => { e.stopPropagation(); handleProcess(); }} className="!rounded-xl shadow-xl shadow-blue-600/20">Convert Now</Button>
                                  <Button variant="secondary" onClick={(e) => { e.stopPropagation(); reset(); }} className="!bg-white/5 !border-white/10 !text-slate-400 !rounded-xl">Clear</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center">
                                <h3 className="text-2xl font-bold text-white mb-3">Drop files here</h3>
                                <p className="text-slate-500 mb-8">or click to browse your computer</p>
                                <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mb-2">
                                  <label className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                                    <input type="checkbox" className="rounded border-white/10 bg-white/5" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} onClick={e => e.stopPropagation()} />
                                    <span>Batch Mode</span>
                                  </label>
                                  <div className="w-px h-4 bg-white/10" />
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    <span>E2E Encrypted</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </PremiumGlassCard>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                      >
                        <PremiumGlassCard className="border-indigo-500/20 min-h-[400px] flex flex-col items-center justify-center text-center">
                          {status === 'processing' && (
                            <>
                              <div className="relative mb-10">
                                <svg className="w-32 h-32 transform -rotate-90">
                                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                  <motion.circle
                                    cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-500"
                                    strokeDasharray={377}
                                    strokeDashoffset={377 - (377 * progress) / 100}
                                    transition={{ duration: 0.5 }}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white font-mono">
                                  {Math.round(progress)}%
                                </div>
                              </div>
                              <h3 className="text-2xl font-bold text-white mb-2">Processing...</h3>
                              <p className="text-slate-500 max-w-xs mx-auto">Transforming your data using our premium edge nodes.</p>
                              {etaSeconds !== null && <div className="mt-4 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-tighter">Est. Time: {etaSeconds}s</div>}
                            </>
                          )}

                          {status === 'done' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 text-emerald-400 shadow-2xl shadow-emerald-500/20">
                                <CheckCircle2 size={48} />
                              </div>
                              <h3 className="text-3xl font-bold text-white mb-2">Success!</h3>
                              <p className="text-slate-500 mb-10">Your file is ready and optimized for quality.</p>
                              <div className="flex gap-4 justify-center">
                                <Button variant="secondary" onClick={reset} className="!bg-white/5 !border-white/10 !text-slate-300 !rounded-xl !px-6"><RefreshCw size={18}/> New</Button>
                                <Button onClick={download} className="!rounded-xl !px-10 shadow-xl shadow-blue-600/20"><Download size={18}/> Download</Button>
                              </div>
                            </motion.div>
                          )}

                          {status === 'error' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/30 text-red-400">
                                <X size={40} />
                              </div>
                              <h3 className="text-2xl font-bold text-white mb-2">Failed</h3>
                              <p className="text-slate-500 mb-8 max-w-xs mx-auto">{errorInfo || 'Unexpected pipeline error. Please retry.'}</p>
                              <Button onClick={reset} variant="secondary" className="!bg-white/5 !border-white/10 !text-slate-300 !rounded-xl">Back to Start</Button>
                            </motion.div>
                          )}
                        </PremiumGlassCard>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Formats Section */}
            <Section id="formats" className="relative z-10 pt-32">
              <div className="text-center mb-16">
                <FadeIn>
                  <Badge color="blue">Global Toolbox</Badge>
                  <h2 className="text-4xl md:text-5xl font-bold mt-6 text-white tracking-tight font-display">Supported Formats</h2>
                  <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-lg">Over 200+ secure conversion pathways available instantly.</p>
                </FadeIn>
              </div>

              <FadeIn delay={0.2}>
                <div className="max-w-4xl mx-auto mb-12">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-blue-600/20 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search for a tool (e.g. PDF to Word, HEIC to JPG...)"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-10 backdrop-blur-xl transition-all"
                    />
                  </div>
                </div>
              </FadeIn>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleTools.map((tool, i) => (
                  <motion.button
                    key={tool.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -5, backgroundColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => { selectTool(tool.id); scrollToConverter(); }}
                    className="glass-pro p-6 rounded-[24px] text-left border border-white/5 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={16} className="text-blue-500" />
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                      {tool.icon}
                    </div>
                    <div className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{tool.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{tool.type}</div>
                  </motion.button>
                ))}
              </div>
            </Section>

            {/* Features Section */}
            <Section id="security" className="pt-40">
              <div className="grid lg:grid-cols-3 gap-8">
                <PremiumGlassCard>
                  <ShieldCheck className="text-blue-500 mb-6" size={32} />
                  <h3 className="text-xl font-bold text-white mb-4">Enterprise Security</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">Military-grade AES-256 encryption for all data transfers. Your privacy is our highest priority.</p>
                </PremiumGlassCard>
                <PremiumGlassCard>
                  <Zap className="text-indigo-500 mb-6" size={32} />
                  <h3 className="text-xl font-bold text-white mb-4">Edge Architecture</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">Distributed workers across 42 global regions ensure minimal latency and blazing fast processing.</p>
                </PremiumGlassCard>
                <PremiumGlassCard>
                  <Globe2 className="text-violet-500 mb-6" size={32} />
                  <h3 className="text-xl font-bold text-white mb-4">Cloud Native</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">Auto-scaling infrastructure that handles anything from single files to massive batch workloads.</p>
                </PremiumGlassCard>
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
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
                  {status === 'error' && (
                    <div className="text-center py-10">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                        <X size={36} />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">Conversion failed</h3>
                      <div className="text-sm text-slate-500 mb-6">{errorInfo || 'Please try again or use another format.'}</div>
                      <div className="flex gap-4 justify-center">
                        <Button variant="secondary" onClick={reset}>Back</Button>
                        <Button variant="primary" onClick={handleProcess}>Retry</Button>
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
              <button onClick={() => navigate('/about')} className="block hover:text-white">About</button>
              <button onClick={() => navigate('/contact')} className="block hover:text-white">Careers</button>
              <button onClick={() => navigate('/blog')} className="block hover:text-white">Blog</button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Legal</div>
            <div className="space-y-2">
              <button onClick={() => navigate('/privacy')} className="block hover:text-white">Privacy</button>
              <button onClick={() => navigate('/terms')} className="block hover:text-white">Terms</button>
              <button onClick={() => scrollToId('support')} className="block hover:text-white">DMCA</button>
              <button onClick={() => navigate('/legal')} className="block hover:text-white">Security</button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">Support</div>
            <div className="space-y-2">
              <button onClick={() => navigate('/faq')} className="block hover:text-white">Help center</button>
              <button onClick={() => navigate('/contact')} className="block hover:text-white">Contact</button>
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
      <MilkaPaw isVisible={showMilka} />
    </div>
  );
}













