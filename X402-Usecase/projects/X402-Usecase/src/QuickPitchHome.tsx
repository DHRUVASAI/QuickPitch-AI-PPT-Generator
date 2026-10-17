import React, { useState, useEffect, useRef } from 'react'
import { TalkWithYouTubeModal } from './components/TalkWithYouTubeModal'

// ── COLOR THEMES DEFINITION ──────────────────────────────────────────────────
interface ThemeConfig {
  id: string;
  name: string;
  bg: string;
  cardBg: string;
  accent: string;
  accentSecondary: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  category: string;
}

const THEMES: ThemeConfig[] = [
  { id: 'cyber-blue', name: 'Cyber Blue', category: 'Tech & AI', bg: '#0F172A', cardBg: '#1E293B', accent: '#38BDF8', accentSecondary: '#818CF8', textPrimary: '#F8FAFC', textMuted: '#94A3B8', border: '#334155' },
  { id: 'monochrome-dark', name: 'Monochrome Dark', category: 'Executive', bg: '#000000', cardBg: '#111111', accent: '#FFFFFF', accentSecondary: '#888888', textPrimary: '#FFFFFF', textMuted: '#AAAAAA', border: '#262626' },
  { id: 'emerald-growth', name: 'Emerald Growth', category: 'Finance', bg: '#064E3B', cardBg: '#022C22', accent: '#34D399', accentSecondary: '#F59E0B', textPrimary: '#ECFDF5', textMuted: '#6EE7B7', border: '#047857' },
  { id: 'midnight-purple', name: 'Midnight Purple', category: 'Creative', bg: '#1E1B4B', cardBg: '#2E1065', accent: '#A78BFA', accentSecondary: '#EC4899', textPrimary: '#FAF5FF', textMuted: '#C084FC', border: '#4C1D95' },
  { id: 'neon-matrix', name: 'Neon Matrix', category: 'Engineering', bg: '#000000', cardBg: '#09090B', accent: '#22C55E', accentSecondary: '#06B6D4', textPrimary: '#FFFFFF', textMuted: '#4ADE80', border: '#15803D' },
  { id: 'crimson-luxe', name: 'Crimson Luxe', category: 'Pitch', bg: '#4C0519', cardBg: '#881337', accent: '#FB7185', accentSecondary: '#F43F5E', textPrimary: '#FFF1F2', textMuted: '#FDA4AF', border: '#9F1239' },
  { id: 'warm-sunset', name: 'Warm Sunset', category: 'Keynote', bg: '#18181B', cardBg: '#27272A', accent: '#F59E0B', accentSecondary: '#F43F5E', textPrimary: '#FAFAFA', textMuted: '#A1A1AA', border: '#3F3F46' },
  { id: 'monochrome-light', name: 'Clean White Light', category: 'Minimalist', bg: '#FFFFFF', cardBg: '#F4F4F5', accent: '#000000', accentSecondary: '#444444', textPrimary: '#000000', textMuted: '#555555', border: '#E4E4E7' },
]

// ── PRESET SHOWCASE DEMOS ─────────────────────────────────────────────────────
const PRESET_DEMOS = [
  {
    id: 'dhoni-leadership',
    title: '🏏 MS Dhoni Leadership Masterclass',
    category: 'KEYNOTE & INTERVIEW',
    badge: 'Trending Demo',
    desc: 'Decision-making under high pressure, tactical team empowerment, and emotional composure in championship finals.',
    mode: 'text',
    text: 'Raj Shamani and MS Dhoni in-depth interview transcript: Raj Shamani interviews cricket legend MS Dhoni on leadership, decision-making under high pressure, maintaining calmness during intense cricket matches, building a resilient team culture, handling public criticism, personal discipline, financial investments, and life after professional cricket. Main topics: 1. Leadership Philosophy & Staying Cool Under Pressure. 2. Strategic Mindset in High-Stakes Matches. 3. Handling Public Scrutiny & Media Pressure. 4. Building Team Trust & Empowering Young Players. 5. Entrepreneurship, Wealth Management, and Next Chapter.',
    theme: 'cyber-blue',
    detail: 'detailed'
  },
  {
    id: 'ai-agents',
    title: '🤖 Autonomous AI Agents Roadmap',
    category: 'TECH & STARTUP PITCH',
    badge: 'Enterprise Architecture',
    desc: 'Multi-agent orchestration, tool routing, memory networks, safety guardrails, and token-based monetization.',
    mode: 'text',
    text: 'Executive Pitch: Next-Gen Autonomous AI Agent Platform. Overview of multi-agent orchestration, tool routing, memory networks, and zero-shot reasoning. Architecture highlights: Agent Loop, Tool Call Interceptor, Memory Storage, and Safety Guardrails. Monetization: Pay-per-token API, enterprise self-hosted deployment, and developer marketplace.',
    theme: 'neon-matrix',
    detail: 'balanced'
  },
  {
    id: 'x402-fintech',
    title: '⚡ Fintech Micropayments Deep-Dive',
    category: 'FINTECH & WEB3',
    badge: 'Protocol Standard',
    desc: 'HTTP 402 Payment Required status code, smart cryptosignatures, sub-cent settlement, and API monetization.',
    mode: 'text',
    text: 'Technical Deep-Dive: Micropayment Protocol for APIs. Problem: Traditional payment gateways have high fees ($0.30 + 3%), breaking pay-per-use APIs. Solution: HTTP payment standard built on blockchain. Benefits: Instant sub-cent payments, fast finality, zero subscription friction. Architecture: Resource Server -> Payment Middleware -> Facilitator -> Settlement Layer.',
    theme: 'emerald-growth',
    detail: 'balanced'
  },
  {
    id: 'steve-jobs',
    title: '📱 Steve Jobs 2007 iPhone Keynote',
    category: 'YOUTUBE DEMO',
    badge: 'Product Disruption',
    desc: 'Revolutionary multitouch user interface, iPod + Phone + Internet synthesis, and mobile computing transformation.',
    mode: 'youtube',
    url: 'https://www.youtube.com/watch?v=8tK5z83unaM',
    text: '',
    theme: 'monochrome-dark',
    detail: 'detailed'
  }
]

// ── SAMPLE SLIDES FOR INTERACTIVE LIVE PREVIEW ──────────────────────────────
const SAMPLE_PREVIEW_SLIDES = [
  {
    title: "Executive Summary & Core Strategic Vision",
    subtitle: "High-level synthesis of source context, primary thesis, and target objectives",
    category: "EXECUTIVE BLUEPRINT",
    cards: [
      { card_title: "Core Thesis & Setting", points: ["Foundational context and driving market dynamics", "Primary observations shaping competitive positioning", "Strategic takeaway for executive leadership"] },
      { card_title: "Key Value Creation Pillars", points: ["Long-term customer retention and value realization", "Operational resilience and rapid tactical execution", "Target resonance across core consumer segments"] }
    ]
  },
  {
    title: "Strategic Decision-Making Under Pressure",
    subtitle: "Calmness protocols, emotional filtering, and frontline delegation frameworks",
    category: "LEADERSHIP INSIGHTS",
    cards: [
      { card_title: "Noise Filtering & Clarity", points: ["Eliminating extraneous media scrutiny and high-stakes distraction", "Prioritizing data-grounded instinct over impulsive reaction", "Maintaining composure during critical operational bottlenecks"] },
      { card_title: "Empowering Team Trust", points: ["Delegating frontline authority to key specialists", "Building psychological safety within high-pressure environments", "Encouraging calculated risk-taking with zero blame culture"] }
    ]
  },
  {
    title: "Future Scope & Enduring Transformation",
    subtitle: "Scalable expansion trajectory, learning feedback loops, and long-term legacy",
    category: "HORIZON & ROADMAP",
    cards: [
      { card_title: "Sustainable Growth Model", points: ["Cross-domain application of unified operational principles", "Continuous adaptive feedback loops and talent acceleration", "Optimized capital allocation and technological leverage"] },
      { card_title: "Guiding Principles for Teams", points: ["Enduring operational ethos for innovators and leaders", "Repeatable execution playbook for high-performance squads", "Measurement milestones and impact verification"] }
    ]
  }
]

export default function QuickPitchHome() {
  // Input States
  const [mode, setMode] = useState<'youtube' | 'audio' | 'text'>('youtube')
  const [youtubeUrl, setYoutubeUrl] = useState('https://www.youtube.com/watch?v=8tK5z83unaM')
  const [rawText, setRawText] = useState('')
  const [audioFileName, setAudioFileName] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  
  // Customization States (Round 3 Item 1)
  const [selectedTheme, setSelectedTheme] = useState('cyber-blue')
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<'concise' | 'balanced' | 'detailed'>('balanced')
  const [selectedTone, setSelectedTone] = useState('Executive Investor Pitch')
  const [slideCount, setSlideCount] = useState(6)
  const [bulletsPerSlide, setBulletsPerSlide] = useState(3)
  const [wordsPerBullet, setWordsPerBullet] = useState(14)
  const [audience, setAudience] = useState('Executive Leadership')
  const [tone, setTone] = useState('Strategic & Visionary')
  const [speakerNotes, setSpeakerNotes] = useState(true)
  const [includeAgenda, setIncludeAgenda] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [focusText, setFocusText] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [doNotCache, setDoNotCache] = useState(false)
  const [slideAdjustmentNotice, setSlideAdjustmentNotice] = useState<string | null>(null)

  // UI States
  const [loading, setLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [allowCloudFallback, setAllowCloudFallback] = useState(false)
  const [spokenLanguage, setSpokenLanguage] = useState<string | undefined>(undefined)
  const [partialNotice, setPartialNotice] = useState<string | null>(null)
  const [cloudProviderNotice, setCloudProviderNotice] = useState<string | null>(null)
  const [languagePrompt, setLanguagePrompt] = useState<{
    detectedLanguage: string;
    confidence: number;
    message: string;
    outputLanguage?: string;
    transcribedText?: string;
  } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedSeconds, setEstimatedSeconds] = useState(15)
  const [openSlideshowModal, setOpenSlideshowModal] = useState(false)
  const [openChatModal, setOpenChatModal] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // ROI Calculator States
  const [decksPerMonth, setDecksPerMonth] = useState(8)
  const [hoursPerDeck, setHoursPerDeck] = useState(4)

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Opening Intro Animation State
  const [showSplash, setShowSplash] = useState(true)
  const [splashProgress, setSplashProgress] = useState(0)
  const [splashFading, setSplashFading] = useState(false)

  const triggerReplaySplash = () => {
    setSplashProgress(0)
    setSplashFading(false)
    setShowSplash(true)
  }

  useEffect(() => {
    if (!showSplash) return
    const interval = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setSplashFading(true), 200)
          setTimeout(() => setShowSplash(false), 900)
          return 100
        }
        return prev + 2
      })
    }, 25)
    return () => clearInterval(interval)
  }, [showSplash])

  // Interactive 3D tilt ref
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021'
  const activeThemeConfig = THEMES.find(t => t.id === selectedTheme) || THEMES[0]

  // Handle 3D Tilt Hover effect on live slide preview
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    setTilt({ x: (y / rect.height) * -8, y: (x / rect.width) * 8 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  // AWS Audio Transcribe helper
  const transcribeAudioFile = async (file: File): Promise<string | null> => {
    const endpoints = [
      '/api-proxy/transcribe-audio',
      `${apiBaseUrl}/transcribe-audio`,
      'http://127.0.0.1:4021/transcribe-audio',
      'http://localhost:4021/transcribe-audio'
    ]

    const formData = new FormData()
    formData.append('audio', file)

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, { method: 'POST', body: formData })
        if (resp.ok) {
          const data = await resp.json()
          if (data.transcript && data.transcript.length > 20) {
            return data.transcript
          }
        }
      } catch { /* try next endpoint */ }
    }
    return null
  }

  const getPayload = (transcribedText?: string, confirmedSpokenLang?: string) => {
    const activeSpoken = confirmedSpokenLang || spokenLanguage;
    const base = {
      theme: selectedTheme,
      detail_level: selectedDetailLevel,
      slide_count: slideCount,
      bullets_per_slide: bulletsPerSlide,
      words_per_bullet: wordsPerBullet,
      audience,
      tone,
      speaker_notes: speakerNotes,
      agenda: includeAgenda,
      summary: includeSummary,
      focus_text: focusText || undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      do_not_cache: doNotCache,
      allow_cloud_fallback: allowCloudFallback,
      output_language: 'en',
      spoken_language: activeSpoken,
      user_confirmed_spoken_language: Boolean(activeSpoken),
      user_confirmed_language: Boolean(activeSpoken),
    }
    if (mode === 'youtube') {
      return { ...base, source_type: 'youtube', url: youtubeUrl }
    } else if (mode === 'text') {
      return { ...base, source_type: 'text', text: rawText }
    } else {
      const textToSend = transcribedText || rawText || `Audio presentation for file: ${audioFileName}`
      return { ...base, source_type: 'audio', text: textToSend }
    }
  }

  const validateInput = () => {
    if (mode === 'youtube') {
      if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
        setError('Please enter a valid YouTube video URL'); return false
      }
    } else if (mode === 'text') {
      if (!rawText.trim()) { setError('Please enter or paste research notes or transcript text'); return false }
    } else if (mode === 'audio') {
      if (!audioFileName && !rawText.trim()) { setError('Please upload an audio file or enter text'); return false }
    }
    return true
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFileName(file.name)
      setAudioFile(file)
      setError('')

      const isTextFile = file.name.endsWith('.txt') || file.name.endsWith('.vtt') || file.name.endsWith('.srt') || file.name.endsWith('.md')
      if (isTextFile) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          if (content) {
            setRawText(content.slice(0, 50000))
            setAudioFile(null)
          }
        }
        reader.readAsText(file)
      } else {
        setRawText('')
      }
    }
  }

  // Auto-enhance user text prompt
  const handleEnhancePrompt = () => {
    if (!rawText.trim()) {
      setRawText('Create an executive pitch deck covering: 1. Core Problem & Market Inefficiency 2. Our System Architecture & Innovation 3. Market Size & Target Audience 4. Competitive Moats 5. Business Model & Monetization Strategy 6. 12-Month Execution Roadmap.')
    } else {
      setRawText((prev) => `${prev.trim()}\n\nKey Strategic Focus Areas:\n- Executive Summary & Foundational Setting\n- Core System Differentiators & Competitive Moat\n- Market Opportunity, ROI & Scalable Growth`)
    }
  }

  // Preset quick-loader
  const loadPreset = (preset: typeof PRESET_DEMOS[0]) => {
    setMode(preset.mode as any)
    if (preset.mode === 'youtube') setYoutubeUrl(preset.url || '')
    if (preset.mode === 'text') setRawText(preset.text)
    setSelectedTheme(preset.theme)
    setSelectedDetailLevel(preset.detail as any)
    setError('')
    setDone(false)
  }

  // Main Generation Handler
  const handleGenerate = async (confirmedSpokenLang?: string | React.MouseEvent, cachedTranscribedText?: string) => {
    if (!validateInput()) return
    setLoading(true); setError(''); setDone(false)
    setPartialNotice(null); setCloudProviderNotice(null)
    setLanguagePrompt(null)

    // Calculate dynamic ETA based on pipeline path (Audio Path: ~15s with Batched Whisper, Text: ~4s)
    const initialEta = mode === 'text' ? 4 : (mode === 'audio' || !rawText ? 15 : 10);
    setEstimatedSeconds(initialEta);
    setElapsedSeconds(0);
    const progressTimer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    const chosenSpoken = typeof confirmedSpokenLang === 'string' ? confirmedSpokenLang : spokenLanguage;
    if (typeof confirmedSpokenLang === 'string') {
      setSpokenLanguage(confirmedSpokenLang);
    }

    let transcribedText: string | undefined = cachedTranscribedText
    if (mode === 'audio' && audioFile && !transcribedText) {
      setStatus('🎙️ Transcribing audio with Faster-Whisper / AWS...')
      setIsTranscribing(true)
      const result = await transcribeAudioFile(audioFile)
      setIsTranscribing(false)
      if (result) {
        transcribedText = result
        setRawText(result)
        setStatus(`✅ Transcribed ${result.length.toLocaleString()} characters. Structuring slide deck...`)
      } else {
        setStatus('⚠️ Analyzing audio metadata context...')
        transcribedText = undefined
      }
    } else {
      setStatus(`Generating ${selectedDetailLevel === 'detailed' ? '12-15' : '8-10'} slide executive deck...`)
    }

    const endpoints = [
      '/api-proxy/generate-ppt',
      `${apiBaseUrl}/generate-ppt`,
      '/api-proxy/generate-ppt-demo',
      `${apiBaseUrl}/generate-ppt-demo`,
      'http://127.0.0.1:4021/generate-ppt',
      'http://localhost:4021/generate-ppt'
    ];

    try {
      let lastError: any = null;
      for (const ep of endpoints) {
        try {
          const response = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getPayload(transcribedText, chosenSpoken)),
          });

          // Check if server flagged low spoken language confidence and requested user clarification
          if (response.status === 422) {
            try {
              const errJson = await response.json();
              if (errJson.status === 'needs_spoken_language_selection' || errJson.status === 'needs_language_selection') {
                setLoading(false);
                setStatus('');
                setLanguagePrompt({
                  detectedLanguage: errJson.detected_language || 'unknown',
                  confidence: errJson.language_confidence || 0,
                  message: errJson.message || 'Low language confidence detected in spoken audio. Please confirm spoken language.',
                  outputLanguage: errJson.current_output_language || 'en',
                  transcribedText,
                });
                return;
              }
            } catch {
              // fallback to regular error handling
            }
          }

          if (!response.ok) throw new Error(`Server error (${response.status}).`);

          // Read headers for partial notice and cloud provider info
          const qpStatus = response.headers.get('X-QuickPitch-Status');
          const qpNotice = response.headers.get('X-QuickPitch-Notice');
          const qpProvider = response.headers.get('X-QuickPitch-Provider');

          if (qpStatus === 'partial') {
            setPartialNotice(qpNotice || 'Presentation was compiled using partial recovery synthesis.');
          }
          if (qpProvider && qpProvider !== 'ollama' && qpProvider !== 'deterministic-fallback') {
            setCloudProviderNotice(`Cloud provider fallback was used: ${qpProvider}`);
          }
          const qpAdjustment = response.headers.get('X-QuickPitch-Slide-Adjustment');
          if (qpAdjustment) {
            setSlideAdjustmentNotice(qpAdjustment);
          }

          setStatus(`✅ Presentation compiled & downloaded!`);
          const blob = await response.blob();
          triggerDownload(blob)
          setDone(true);
          return;
        } catch (err: any) {
          lastError = err;
        }
      }

      setError(lastError?.message || 'Server connection failed. Ensure backend server is active on port 4021.');
      setStatus('');
    } finally {
      clearInterval(progressTimer);
      setLoading(false);
    }
  }

  const triggerDownload = (blob: Blob) => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `QuickPitch_${selectedTheme}_${Date.now()}.pptx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    }, 1000);
  }

  // Keyboard navigation for full-screen slideshow modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!openSlideshowModal) return
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex(prev => (prev + 1) % SAMPLE_PREVIEW_SLIDES.length)
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => (prev - 1 + SAMPLE_PREVIEW_SLIDES.length) % SAMPLE_PREVIEW_SLIDES.length)
      } else if (e.key === 'Escape') {
        setOpenSlideshowModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openSlideshowModal])

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] selection:bg-[#ff2a55] selection:text-white relative overflow-hidden font-sans">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="ambient-glow-top" />
      <div className="ambient-glow-side" />
      <div className="absolute inset-0 ambient-grid pointer-events-none z-0" />

      {/* 🧭 NAVIGATION HEADER */}
      <header className="relative z-30 border-b border-white/[0.08] bg-[#07090e]/80 backdrop-blur-xl sticky top-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-3.5 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d50000] via-[#ff2a55] to-[#fb7185] flex items-center justify-center text-white font-bold text-xl shadow-glow-brand group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-black text-2xl tracking-tight text-white">
                  Quick<span className="text-gradient-brand">Pitch</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                  AI v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium -mt-0.5">Presentation Intelligence & Slide Synthesis</p>
            </div>
          </div>

          {/* Quick Engine Status Ticker */}
          <div className="hidden lg:flex items-center space-x-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Local GPU Engine Ready (RTX 4060)</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div>Tier: <span className="text-emerald-400 font-bold">100% Free</span></div>
            <div className="h-4 w-px bg-white/10" />
            <div>Latency: <span className="text-amber-400 font-bold">~3.3s</span></div>
          </div>

          {/* Action Navigation Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (youtubeUrl) setOpenChatModal(true);
                else {
                  setMode('youtube');
                  setYoutubeUrl('https://www.youtube.com/watch?v=8tK5z83unaM');
                  setOpenChatModal(true);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white font-mono text-xs transition flex items-center space-x-1.5"
            >
              <span>💬 Chat with Video</span>
            </button>
            <button
              onClick={triggerReplaySplash}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white font-mono text-xs transition flex items-center space-x-1.5"
              title="Replay Opening Intro Animation"
            >
              <span>🎬 Intro</span>
            </button>
          </div>
        </div>
      </header>

      {/* 🚀 HERO SECTION */}
      <section className="relative z-10 pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* Release Pill Badge */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-slate-300 mb-8 backdrop-blur-md shadow-xl hover:border-brand-500/30 transition">
          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 text-white font-bold text-[10px] uppercase tracking-wide">
            POWERED BY AI
          </span>
          <span>Adaptive Multi-Layout Presentation Engine v2.5</span>
          <svg className="w-3.5 h-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>

        {/* Main Display Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-black tracking-tight max-w-5xl mx-auto leading-[1.08] mb-6">
          Transform YouTube, Audio & Text into <br />
          <span className="text-gradient-brand">Executive-Grade Presentation Decks</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
          Turn any video lecture, interview, or technical document into beautifully structured, natively styled <strong className="text-white font-semibold">.pptx PowerPoint files</strong> in seconds — completely free with local offline AI acceleration.
        </p>

        {/* Feature Highlights Badges */}
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto mb-12 text-xs font-mono text-slate-300">
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <span className="text-brand-400 font-bold">✓</span> <span>8 Curated Executive Color Themes</span>
          </div>
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <span className="text-brand-400 font-bold">✓</span> <span>Multilingual Indic & Global Scripts</span>
          </div>
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <span className="text-brand-400 font-bold">✓</span> <span>100% Native PowerPoint (.pptx) Format</span>
          </div>
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <span className="text-emerald-400 font-bold">✓</span> <span>Instant Download — Zero Signups</span>
          </div>
        </div>

        {/* 🌟 PRESET DEMO GALLERY (1-CLICK TEST DRIVE) */}
        <div className="mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-5 flex items-center justify-center space-x-2">
            <span className="w-8 h-px bg-slate-700" />
            <span>⚡ 1-Click Instant Demo Presets (Test Drive Without Typing)</span>
            <span className="w-8 h-px bg-slate-700" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left max-w-6xl mx-auto">
            {PRESET_DEMOS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className="glass-card p-5 cursor-pointer group hover:border-brand-500/40 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-brand-400 uppercase tracking-wider">{preset.category}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">{preset.badge}</span>
                </div>
                <div className="font-heading font-bold text-sm text-white group-hover:text-brand-400 transition mb-2">
                  {preset.title}
                </div>
                <div className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {preset.desc}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-white/[0.06]">
                  <span className="capitalize">{preset.theme.replace('-', ' ')}</span>
                  <span className="text-white font-semibold group-hover:text-brand-400 group-hover:translate-x-1 transition flex items-center space-x-1">
                    <span>Try Preset</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🛠️ MAIN GENERATION STUDIO & LIVE PREVIEWER */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: CONTROLS & INPUT FORM (7 COLS) */}
          <div className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-2xl relative shadow-2xl">
            
            {/* Input Mode Selector Tabs */}
            <div className="flex bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.08] mb-8">
              <button
                onClick={() => setMode('youtube')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                  mode === 'youtube'
                    ? 'bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 text-white shadow-lg shadow-brand-500/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>📺 YouTube Video</span>
              </button>
              <button
                onClick={() => setMode('audio')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                  mode === 'audio'
                    ? 'bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 text-white shadow-lg shadow-brand-500/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>🎙️ Audio / Speech</span>
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                  mode === 'text'
                    ? 'bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 text-white shadow-lg shadow-brand-500/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>📝 Text / Prompt</span>
              </button>
            </div>

            {/* INPUT FIELDS */}

            {/* MODE 1: YOUTUBE */}
            {mode === 'youtube' && (
              <div className="space-y-4 mb-8">
                <label className="block text-xs font-mono font-semibold text-slate-300">
                  YOUTUBE VIDEO URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono transition shadow-inner"
                  />
                  {youtubeUrl && (
                    <button
                      onClick={() => setYoutubeUrl('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/[0.06]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Talk with Video Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>AI Model: <strong className="text-white">Qwen 2.5 7B Local GPU</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
                        setError('Please enter a valid YouTube URL first to chat with it');
                        return;
                      }
                      setError('');
                      setOpenChatModal(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 hover:opacity-90 text-white font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/25"
                  >
                    <span>💬 Talk with YouTube Video</span>
                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono">AI Q&A</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">
                  <p>
                    💡 Works with lectures, podcasts, interviews, and product keynotes. Grounded in verified captions & speech.
                  </p>
                  <span className="inline-flex items-center text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30 whitespace-nowrap self-start sm:self-auto">
                    ⏱️ Up to 60-min max
                  </span>
                </div>
              </div>
            )}

            {/* MODE 2: AUDIO FILE */}
            {mode === 'audio' && (
              <div className="space-y-4 mb-8">
                <label className="block text-xs font-mono font-semibold text-slate-300">
                  UPLOAD AUDIO OR SPEECH FILE (LOCAL GPU WHISPER / AWS TRANSCRIBE)
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/60 rounded-2xl p-8 text-center bg-[#0a0f1d]/50 transition cursor-pointer relative group">
                  <input
                    type="file"
                    accept="audio/*,.txt,.vtt,.srt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  {audioFileName ? (
                    <div>
                      <div className="text-sm font-semibold text-emerald-400">Selected: {audioFileName}</div>
                      <div className="text-xs text-slate-400 mt-1">Click or drop new file to replace</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-200">Drag & Drop audio file here or click to browse</div>
                      <div className="text-xs text-slate-400 mt-1">Supports MP3, WAV, M4A, AAC, FLAC (Up to 500MB)</div>
                    </div>
                  )}
                </div>

                {/* Animated Waveform Preview */}
                {audioFileName && (
                  <div className="flex items-center justify-center space-x-1.5 py-3.5 bg-white/[0.03] rounded-xl border border-white/[0.08]">
                    <span className="text-xs font-mono text-brand-400 mr-2">Audio Visualizer Active:</span>
                    {[12, 24, 18, 32, 14, 28, 20, 36, 16, 26, 12, 30].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 bg-brand-500 rounded-full sound-bar"
                        style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: RAW TEXT */}
            {mode === 'text' && (
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-semibold text-slate-300">
                    MEETING NOTES, INTERVIEW TRANSCRIPT, OR RESEARCH TEXT
                  </label>
                  <button
                    onClick={handleEnhancePrompt}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1"
                  >
                    <span>✨ Magic Enhance Prompt</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste research summaries, transcripts, lecture notes, or business memos here..."
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-brand-500 font-mono transition shadow-inner leading-relaxed"
                />
              </div>
            )}

            {/* 🎨 CUSTOMIZATION OPTIONS */}
            <div className="space-y-6 pt-6 border-t border-white/[0.08]">
              
              {/* Theme Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-mono font-semibold text-slate-300">
                    SELECT EXECUTIVE VISUAL THEME
                  </label>
                  <span className="text-xs font-mono text-brand-400">{activeThemeConfig.name}</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center space-y-1.5 transition-all ${
                        selectedTheme === t.id
                          ? 'border-brand-500 shadow-md shadow-brand-500/20 scale-105 ring-2 ring-brand-500/30'
                          : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
                      }`}
                      style={{ backgroundColor: t.bg }}
                    >
                      <div className="w-full h-3 rounded flex space-x-1">
                        <span className="flex-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                        <span className="flex-1 rounded-sm" style={{ backgroundColor: t.accentSecondary }} />
                      </div>
                      <div className="text-[9px] font-mono truncate text-center" style={{ color: t.textPrimary }}>
                        {t.id.split('-')[0]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Level Selector */}
              {/* SLIDE COUNT (3 - 30) & ESTIMATED TIME BADGE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-semibold text-slate-300">
                    SLIDE COUNT: <span className="text-brand-400 font-bold text-sm">{slideCount} Slides</span> (Range: 3 - 30)
                  </label>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-full flex items-center space-x-1.5 shadow-sm">
                    <span>⚡ ETA:</span>
                    <span className="font-bold text-white">{Math.round(25 + slideCount * 4.5)}s - {Math.round(32 + slideCount * 5.2)}s</span>
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min={3}
                    max={30}
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                    className="flex-1 accent-brand-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={slideCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) setSlideCount(Math.max(3, Math.min(30, val)));
                    }}
                    className="w-16 bg-[#0a0f1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-center font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
                  <span>3 (Brief)</span>
                  <span>6 (Standard)</span>
                  <span>10 (Deck)</span>
                  <span>15 (Deep Dive)</span>
                  <span>30 (Full Series)</span>
                </div>
              </div>

              {/* DETAIL LEVEL */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 mb-2">
                  CONTENT DETAIL LEVEL
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'concise', label: 'Concise', sub: 'High impact points', desc: 'Fast executive brief' },
                    { id: 'balanced', label: 'Balanced', sub: 'Context & evidence', desc: 'Standard business deck' },
                    { id: 'detailed', label: 'Comprehensive', sub: 'Deep technical rigor', desc: 'In-depth analysis' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setSelectedDetailLevel(level.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedDetailLevel === level.id
                          ? 'bg-white/[0.08] border-brand-500 text-white shadow-md shadow-brand-500/10'
                          : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold font-heading">{level.label}</div>
                      <div className="text-[10px] font-mono text-brand-400 mt-0.5">{level.sub}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{level.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* BULLETS PER SLIDE & WORDS PER BULLET */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-semibold text-slate-300">BULLETS PER SLIDE</span>
                    <span className="text-brand-400 font-bold">{bulletsPerSlide} / card</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={bulletsPerSlide}
                      onChange={(e) => setBulletsPerSlide(parseInt(e.target.value, 10))}
                      className="flex-1 accent-brand-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-8 text-center text-xs font-mono text-white bg-[#0a0f1d] border border-white/10 rounded py-1">
                      {bulletsPerSlide}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-semibold text-slate-300">WORDS PER BULLET</span>
                    <span className="text-brand-400 font-bold">~{wordsPerBullet} words</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min={3}
                      max={35}
                      value={wordsPerBullet}
                      onChange={(e) => setWordsPerBullet(parseInt(e.target.value, 10))}
                      className="flex-1 accent-brand-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-8 text-center text-xs font-mono text-white bg-[#0a0f1d] border border-white/10 rounded py-1">
                      {wordsPerBullet}
                    </span>
                  </div>
                </div>
              </div>

              {/* AUDIENCE & TONE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-semibold text-slate-300">
                    TARGET AUDIENCE
                  </label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Executive Board, Investors, Engineers"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Board & Execs', 'Investors & VCs', 'Technical Teams', 'Customers'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAudience(a)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                          audience === a ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' : 'bg-white/[0.02] text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-semibold text-slate-300">
                    PRESENTATION TONE
                  </label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g. Strategic, Analytical, Inspiring"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Strategic & Visionary', 'Direct & Analytical', 'Persuasive Pitch', 'Educational'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                          tone === t ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' : 'bg-white/[0.02] text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FOCUS TEXT & TIME WINDOW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-mono font-semibold text-slate-300">
                    CUSTOM FOCUS / TOPICS TO EMPHASIZE (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={focusText}
                    onChange={(e) => setFocusText(e.target.value)}
                    placeholder="e.g. Highlight Q3 financials, architecture moats, competitive analysis"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-semibold text-slate-300">
                    CLIP WINDOW (START / END)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="Start (0:00)"
                      className="w-1/2 bg-[#0a0f1d] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white text-center focus:outline-none focus:border-brand-500 font-mono"
                    />
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="End (5:30)"
                      className="w-1/2 bg-[#0a0f1d] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white text-center focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* TOGGLES: SPEAKER NOTES, AGENDA, SUMMARY, DO NOT CACHE, ENGLISH BADGE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={speakerNotes}
                    onChange={(e) => setSpeakerNotes(e.target.checked)}
                    className="accent-brand-500 w-4 h-4 rounded"
                  />
                  <div className="text-xs font-mono text-slate-200">Speaker Notes</div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAgenda}
                    onChange={(e) => setIncludeAgenda(e.target.checked)}
                    className="accent-brand-500 w-4 h-4 rounded"
                  />
                  <div className="text-xs font-mono text-slate-200">Include Agenda</div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="accent-brand-500 w-4 h-4 rounded"
                  />
                  <div className="text-xs font-mono text-slate-200">Include Summary</div>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doNotCache}
                    onChange={(e) => setDoNotCache(e.target.checked)}
                    className="accent-brand-500 w-4 h-4 rounded"
                  />
                  <div className="text-xs font-mono text-slate-200">Do Not Cache</div>
                </label>
              </div>

              {/* Language Notice (English Output Enforced) */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🇺🇸</span>
                  <span className="font-semibold text-slate-200">Output Language: English</span>
                  <span className="text-slate-500 hidden sm:inline">(All non-English sources auto-translated)</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  Enforced
                </span>
              </div>

              {/* Cloud Fallback Toggle */}
              <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold font-heading text-white flex items-center space-x-2">
                    <span>☁️ Allow Cloud Fallback</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${allowCloudFallback ? 'bg-amber-900/60 text-amber-300 border border-amber-600/50' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/50'}`}>
                      {allowCloudFallback ? 'Opt-In (Groq / Gemini / AWS)' : 'Private Local Only'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 leading-relaxed">
                    {allowCloudFallback
                      ? 'Permits fallback to Groq / Gemini / AWS if local RTX 4060 GPU is offline or times out.'
                      : 'Strict local GPU execution. Never routes your data to cloud providers.'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={allowCloudFallback}
                    onChange={(e) => setAllowCloudFallback(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>
            </div>

            {/* INTERACTIVE SPOKEN-LANGUAGE PICKER */}
            {languagePrompt && (
              <div className="mt-6 p-5 bg-amber-950/40 border-2 border-amber-500/80 rounded-xl space-y-4 shadow-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <span className="text-xl">🎙️</span>
                    <span className="font-heading font-bold text-sm text-amber-300">
                      Spoken Audio Clarification (Confidence: {Math.round(languagePrompt.confidence * 100)}%)
                    </span>
                  </div>
                  <button
                    onClick={() => setLanguagePrompt(null)}
                    className="text-slate-400 hover:text-white text-xs font-mono"
                  >
                    ✕ Dismiss
                  </button>
                </div>

                <div className="text-xs text-slate-300 font-mono space-y-1.5 leading-relaxed">
                  <p>{languagePrompt.message}</p>
                </div>
                <div className="flex gap-2">
                  {['en', 'hi', 'te', 'es', 'fr'].map((langCode) => (
                    <button
                      key={langCode}
                      onClick={() => handleGenerate(langCode, languagePrompt.transcribedText)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold font-mono text-xs hover:bg-amber-400 transition"
                    >
                      Confirm: {langCode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PARTIAL NOTICE DISPLAY */}
            {partialNotice && (
              <div className="mt-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <strong className="text-amber-100 font-bold">Partial Result Notice:</strong>
                    <p className="mt-0.5 text-amber-300/90">{partialNotice}</p>
                  </div>
                </div>
                <button onClick={() => setPartialNotice(null)} className="text-amber-400 hover:text-white text-sm font-bold">✕</button>
              </div>
            )}

            {/* CLOUD PROVIDER NOTICE DISPLAY */}
            {cloudProviderNotice && (
              <div className="mt-6 p-4 rounded-xl bg-blue-950/40 border border-blue-500/60 text-blue-200 text-xs font-mono flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-2">
                  <span className="text-base leading-none">☁️</span>
                  <div>
                    <strong className="text-blue-100 font-bold">Cloud Provider Used:</strong>
                    <p className="mt-0.5 text-blue-300/90">{cloudProviderNotice}</p>
                  </div>
                </div>
                <button onClick={() => setCloudProviderNotice(null)} className="text-blue-400 hover:text-white text-sm font-bold">✕</button>
              </div>
            )}

            {/* SLIDE COUNT ADJUSTMENT NOTICE (Round 3 Item 2) */}
            {slideAdjustmentNotice && (
              <div className="mt-6 p-4 rounded-xl bg-purple-950/40 border border-purple-500/60 text-purple-200 text-xs font-mono flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-2">
                  <span className="text-base leading-none">📐</span>
                  <div>
                    <strong className="text-purple-100 font-bold">Slide Count Enforcement:</strong>
                    <p className="mt-0.5 text-purple-300/90">{slideAdjustmentNotice}</p>
                  </div>
                </div>
                <button onClick={() => setSlideAdjustmentNotice(null)} className="text-purple-400 hover:text-white text-sm font-bold">✕</button>
              </div>
            )}

            {/* BACKGROUND PROGRESS & AUDIO ETA TRACKER (Round 3.6 Item 7) */}
            {loading && (
              <div className="mt-6 p-5 rounded-2xl bg-slate-900/90 border border-brand-500/30 text-white space-y-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-300">
                      {mode === 'audio' || mode === 'youtube' ? 'Audio & Video Pipeline Active' : 'Text Synthesis Pipeline Active'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-300 bg-white/[0.06] px-2.5 py-1 rounded-full border border-white/10">
                    <span>ETA: <strong className="text-emerald-400">~{estimatedSeconds}s</strong></span>
                    <span className="text-slate-500">•</span>
                    <span>Elapsed: <strong className="text-white">{elapsedSeconds}s</strong></span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(95, Math.max(12, (elapsedSeconds / estimatedSeconds) * 90))}%` }}
                  />
                </div>

                {/* Pipeline Step Indicators */}
                <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                  <div className={`p-2 rounded-lg border ${elapsedSeconds >= 1 ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-white/5 bg-white/[0.02] text-slate-500'}`}>
                    <div className="font-bold">1. Ingest</div>
                    <div className="truncate text-[9px] text-slate-400">≤ 60m max check</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${elapsedSeconds >= 3 ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-white/5 bg-white/[0.02] text-slate-500'}`}>
                    <div className="font-bold">2. Whisper</div>
                    <div className="truncate text-[9px] text-slate-400">GPU Batched ASR</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${elapsedSeconds >= 8 ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-white/5 bg-white/[0.02] text-slate-500'}`}>
                    <div className="font-bold">3. Translate</div>
                    <div className="truncate text-[9px] text-slate-400">Bilingual alignment</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${elapsedSeconds >= 12 ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-white/5 bg-white/[0.02] text-slate-500'}`}>
                    <div className="font-bold">4. Groq + PPT</div>
                    <div className="truncate text-[9px] text-slate-400">Verify & Build</div>
                  </div>
                </div>

                {/* Long Audio Background State & Duration Notice */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-emerald-400">✓</span>
                    <span>Supports up to <strong>60-minute duration</strong> (5-min cap removed).</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Batched Whisper ~35x RT</span>
                </div>
              </div>
            )}

            {/* STATUS DISPLAY */}
            {status && (
              <div className="mt-4 p-4 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping" />
                <span>{status}</span>
              </div>
            )}

            {/* ERROR DISPLAY */}
            {error && (
              <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-500/60 text-red-200 text-xs font-mono flex items-start justify-between space-x-3">
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')} className="text-red-400 hover:text-white text-sm font-bold">✕</button>
              </div>
            )}

            {/* ACTION BUTTON - Generate CTA */}
            <div className="mt-8">
              <button
                disabled={loading}
                onClick={() => handleGenerate()}
                className="w-full py-4 px-6 rounded-xl font-heading font-bold text-base bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 hover:opacity-95 active:scale-[0.99] text-white transition-all disabled:opacity-50 flex items-center justify-center space-x-3 tracking-wide shadow-glow-brand shimmer-button"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Slide Deck with AI...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Generate Presentation Deck — Free</span>
                    <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LIVE 3D SLIDE PREVIEWER (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live 3D Slide Preview Canvas */}
            <div className="perspective-container">
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  backgroundColor: activeThemeConfig.bg,
                  borderColor: activeThemeConfig.border,
                }}
                className="tilt-card p-6 sm:p-7 rounded-2xl border relative min-h-[460px] flex flex-col justify-between transition-colors duration-500 overflow-hidden"
              >
                {/* Top Accent Strip */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: activeThemeConfig.accent }}
                />

                {/* Slide Category Header */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span 
                      className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-1 rounded-full border border-current"
                      style={{ backgroundColor: activeThemeConfig.cardBg, color: activeThemeConfig.accent }}
                    >
                      {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      SLIDE 0{currentSlideIndex + 1} / 0{SAMPLE_PREVIEW_SLIDES.length}
                    </span>
                  </div>

                  {/* Slide Title & Subtitle */}
                  <h3 
                    className="font-heading font-black text-xl mb-2 leading-snug"
                    style={{ color: activeThemeConfig.textPrimary }}
                  >
                    {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].title}
                  </h3>
                  <p 
                    className="text-xs mb-6 font-medium leading-relaxed"
                    style={{ color: activeThemeConfig.textMuted }}
                  >
                    {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].subtitle}
                  </p>

                  {/* Cards Mockup (Mirroring PPTX Compiler) */}
                  <div className="grid grid-cols-2 gap-3">
                    {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].cards.map((card, ci) => (
                      <div
                        key={ci}
                        className="p-3.5 rounded-xl border text-left shadow-sm relative overflow-hidden"
                        style={{
                          backgroundColor: activeThemeConfig.cardBg,
                          borderColor: ci === 0 ? activeThemeConfig.accent : activeThemeConfig.border,
                        }}
                      >
                        {/* Top Card Bar */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ backgroundColor: ci === 0 ? activeThemeConfig.accent : activeThemeConfig.accentSecondary }}
                        />
                        <div 
                          className="font-heading font-bold text-xs mb-2 pt-0.5 flex items-center space-x-1.5"
                          style={{ color: activeThemeConfig.textPrimary }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeThemeConfig.accent }} />
                          <span>{card.card_title}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {card.points.map((pt, pi) => (
                            <li 
                              key={pi} 
                              className="text-[10px] flex items-start space-x-1.5 leading-relaxed"
                              style={{ color: activeThemeConfig.textMuted }}
                            >
                              <span style={{ color: activeThemeConfig.accent }}>▪</span>
                              <span className="line-clamp-2">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls & Live Slide Pagination */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs mt-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentSlideIndex(prev => (prev - 1 + SAMPLE_PREVIEW_SLIDES.length) % SAMPLE_PREVIEW_SLIDES.length)}
                      className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white hover:border-brand-500 transition"
                      title="Previous Slide"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentSlideIndex(prev => (prev + 1) % SAMPLE_PREVIEW_SLIDES.length)}
                      className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white hover:border-brand-500 transition"
                      title="Next Slide"
                    >
                      →
                    </button>
                    {/* Slide Dots */}
                    <div className="flex items-center space-x-1 ml-2">
                      {SAMPLE_PREVIEW_SLIDES.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          onClick={() => setCurrentSlideIndex(dotIdx)}
                          className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                            currentSlideIndex === dotIdx ? 'bg-brand-500 w-4' : 'bg-white/20 hover:bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenSlideshowModal(true)}
                    className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-black/40 text-white border border-white/10 hover:border-brand-500 transition flex items-center space-x-1.5"
                  >
                    <span>🔍 Fullscreen Inspector</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Engine Status Terminal */}
            <div className="glass-panel p-5 rounded-2xl font-mono text-xs text-slate-400">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white uppercase tracking-wider">Engine Status</span>
                </div>
                <span className="text-[10px] text-slate-500">QuickPitch v2.5</span>
              </div>
              
              <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
                <div className="text-slate-500">&gt; Endpoint: POST /generate-ppt</div>
                <div className="text-slate-500">&gt; Backend: {apiBaseUrl}</div>
                <div className="text-emerald-400">&gt; Local Synthesis: Qwen 2.5 7B (num_ctx 8192)</div>
                <div className="text-slate-300">&gt; Speech Engine: Faster-Whisper + AWS S3 Transcribe</div>
                <div className="text-white">&gt; Cost: FREE (Open AI presentation pipeline)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 INTERACTIVE ROI & TIME SAVED CALCULATOR */}
      <section className="relative z-10 py-16 bg-[#090d18]/50 border-y border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-brand-400 mb-4">
            <span>⚡ ROI CALCULATOR</span>
          </div>
          <h2 className="text-3xl font-heading font-black mb-3 text-white">
            Calculate Your <span className="text-gradient-brand">Productivity & Time Saved</span>
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto mb-10">
            See how much time and money QuickPitch AI saves your team compared to manual presentation drafting.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center glass-panel p-8 rounded-2xl">
            {/* Sliders */}
            <div className="space-y-6 text-left">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-300">Decks Created Per Month</span>
                  <span className="text-brand-400 font-bold">{decksPerMonth} Decks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={decksPerMonth}
                  onChange={(e) => setDecksPerMonth(parseInt(e.target.value))}
                  className="w-full accent-[#ff2a55] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-300">Hours Spent Per Deck Manually</span>
                  <span className="text-amber-400 font-bold">{hoursPerDeck} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={hoursPerDeck}
                  onChange={(e) => setHoursPerDeck(parseInt(e.target.value))}
                  className="w-full accent-[#f59e0b] cursor-pointer"
                />
              </div>
            </div>

            {/* Calculated Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl bg-white/[0.03] text-center border border-white/[0.08]">
                <div className="text-3xl font-heading font-black text-brand-400 mb-1">
                  {decksPerMonth * hoursPerDeck} hrs
                </div>
                <div className="text-xs font-mono text-slate-400">Monthly Time Saved</div>
              </div>

              <div className="p-6 rounded-xl bg-white/[0.03] text-center border border-white/[0.08]">
                <div className="text-3xl font-heading font-black text-white mb-1">
                  ${(decksPerMonth * hoursPerDeck * 50).toLocaleString()}
                </div>
                <div className="text-xs font-mono text-slate-400">Est. Monthly Savings</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 TECHNOLOGY & ARCHITECTURE HIGHLIGHTS */}
      <section className="relative z-10 py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-brand-400 mb-4">
            <span>⚡ PRODUCTION ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-black text-white mb-4">
            Built for Speed, Privacy, and <span className="text-gradient-brand">Enterprise Fidelity</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            QuickPitch is architected from the ground up for zero-friction generation with a resilient fallback chain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🖥️',
              title: 'Local RTX GPU Synthesis',
              desc: 'Executes locally on your RTX 4060 GPU with Qwen 2.5 7B (8192 context). Zero sensitive business data leaves your machine unless you enable cloud fallback.'
            },
            {
              icon: '🌐',
              title: 'Multilingual Indic & Global Scripts',
              desc: 'Crisp font fallbacks for Devanagari, Telugu, Japanese, and Western typography ensuring no broken or missing glyphs in PowerPoint exports.'
            },
            {
              icon: '⚡',
              title: 'Multi-Provider Failover Chain',
              desc: 'Automatic fallback: Local Whisper & Ollama → Groq LLaMA 3.3 / Gemini → Deterministic NLP deck. Never fails a generation request.'
            },
            {
              icon: '🎙️',
              title: 'Speech-to-Text Pipeline',
              desc: 'Dual transcription pipeline: Faster-Whisper sidecar with VAD chunking + AWS Transcribe integration for high-accuracy long-form speech.'
            },
            {
              icon: '📊',
              title: 'Native OpenXML .pptx',
              desc: 'Outputs genuine PowerPoint binary files (.pptx) with structured shape cards, editable textboxes, and clean color themes compatible across Office, Keynote, and Google Slides.'
            },
            {
              icon: '💬',
              title: 'In-Transcript Neural Chat',
              desc: 'Ask questions directly to any YouTube video using indexed transcript neural search. Instant summaries, quotes, and timestamps on demand.'
            }
          ].map((feature, i) => (
            <div key={i} className="glass-card p-6 rounded-2xl">
              <div className="text-2xl mb-3">{feature.icon}</div>
              <h3 className="font-heading font-bold text-base text-white mb-2">{feature.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ❓ FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
      <section className="relative z-10 py-16 max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-heading font-black text-center mb-10 text-white">
          Frequently Asked <span className="text-gradient-brand">Questions</span>
        </h2>

        <div className="space-y-3">
          {[
            {
              q: 'Is QuickPitch really free?',
              a: 'Yes! QuickPitch is completely free to use. Simply input your YouTube URL, audio file, or text and generate professional presentations instantly — no account or payment required.'
            },
            {
              q: 'Can I edit the generated presentation files in Microsoft PowerPoint?',
              a: 'Yes! QuickPitch generates 100% native OpenXML .pptx files compatible with Microsoft PowerPoint, Google Slides, Apple Keynote, and LibreOffice.'
            },
            {
              q: 'How does YouTube & Audio Speech-to-Text work?',
              a: 'YouTube transcripts are parsed automatically. For raw audio files (MP3/WAV), QuickPitch runs Faster-Whisper on CUDA with fallback to AWS Transcribe speech-to-text before handing the transcript to the slide engine.'
            },
            {
              q: 'What AI models power the presentation generation?',
              a: 'QuickPitch uses a local-first multi-provider pipeline: Qwen 2.5 7B loaded on your RTX 4060 GPU with failover to Groq LLaMA 3.3 and Google Gemini for maximum reliability.'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              className="glass-card p-5 rounded-xl cursor-pointer transition hover:border-white/20"
            >
              <div className="flex items-center justify-between font-heading font-bold text-base text-white">
                <span>{item.q}</span>
                <span className="text-brand-400 text-xl font-mono">{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && (
                <div className="mt-3 text-xs text-slate-400 leading-relaxed font-sans border-t border-white/[0.08] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 🚪 FULLSCREEN SLIDESHOW INSPECTOR MODAL */}
      {openSlideshowModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-5xl glass-panel p-8 rounded-2xl flex flex-col justify-between min-h-[620px]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-mono text-xs font-bold">
                  LIVE SLIDESHOW INSPECTOR
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Slide {currentSlideIndex + 1} of {SAMPLE_PREVIEW_SLIDES.length}
                </span>
              </div>
              <button
                onClick={() => setOpenSlideshowModal(false)}
                className="text-slate-400 hover:text-white text-base font-bold font-mono px-2 py-1 rounded hover:bg-white/[0.06] transition"
              >
                ✕ ESC
              </button>
            </div>

            {/* Slide Body */}
            <div className="my-8 text-center max-w-3xl mx-auto">
              <div className="text-xs font-mono font-bold text-brand-400 uppercase tracking-widest mb-2">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].category}
              </div>
              <h2 className="text-3xl font-heading font-black text-white mb-3">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].title}
              </h2>
              <p className="text-sm text-slate-400 mb-8">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].subtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].cards.map((card, ci) => (
                  <div key={ci} className="bg-black/50 p-6 rounded-xl border border-white/10">
                    <div className="font-heading font-bold text-sm text-white mb-3 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      <span>{card.card_title}</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-400">
                      {card.points.map((pt, pi) => (
                        <li key={pi} className="flex items-start space-x-2">
                          <span className="text-brand-400">▪</span>
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] text-xs font-mono">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCurrentSlideIndex(prev => (prev - 1 + SAMPLE_PREVIEW_SLIDES.length) % SAMPLE_PREVIEW_SLIDES.length)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white hover:border-brand-500 transition"
                >
                  ← Previous Slide
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(prev => (prev + 1) % SAMPLE_PREVIEW_SLIDES.length)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white hover:border-brand-500 transition"
                >
                  Next Slide →
                </button>
              </div>
              <span className="text-slate-400">Use arrow keys or spacebar to navigate</span>
            </div>
          </div>
        </div>
      )}

      {/* 💬 TALK WITH YOUTUBE MODAL (LOCAL GPU QWEN 2.5 7B) */}
      <TalkWithYouTubeModal
        isOpen={openChatModal}
        onClose={() => setOpenChatModal(false)}
        videoUrl={youtubeUrl}
        apiBaseUrl={apiBaseUrl}
      />

      {/* 🎬 OPENING INTRO ANIMATION SPLASH SCREEN */}
      {showSplash && (
        <div 
          className={`fixed inset-0 z-50 bg-[#07090e] flex flex-col items-center justify-center p-6 text-center transition-all duration-700 ${
            splashFading ? 'scale-105 opacity-0 blur-lg pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          {/* Central Logo & Pulse Icon */}
          <div className="relative z-10 mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#d50000] via-[#ff2a55] to-[#fb7185] flex items-center justify-center text-white font-bold text-2xl shadow-glow-brand animate-float">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="relative z-10 font-heading font-black text-4xl sm:text-5xl text-white mb-2 tracking-tight">
            Quick<span className="text-gradient-brand">Pitch</span> AI
          </h1>
          <p className="relative z-10 text-xs font-mono text-slate-400 mb-8 tracking-widest uppercase">
            Presentation Intelligence & Video Synthesis Engine
          </p>

          {/* Progress Bar & Percentage */}
          <div className="relative z-10 w-full max-w-sm bg-white/[0.05] h-2 rounded-full border border-white/10 mb-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-600 via-brand-500 to-rose-600 transition-all duration-75 ease-out rounded-full"
              style={{ width: `${splashProgress}%` }}
            />
          </div>

          <div className="relative z-10 font-mono text-sm font-bold text-brand-400 mb-8">
            Initializing AI Pipeline... <span className="text-white">{splashProgress}%</span>
          </div>

          {/* System Checklist Badges */}
          <div className="relative z-10 flex flex-col space-y-2 text-xs font-mono text-slate-400">
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 20 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-brand-400">✓</span> <span>Local GPU Neural Synthesizer Ready (Qwen 2.5 7B)</span>
            </div>
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 55 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-brand-400">✓</span> <span>Faster-Whisper CUDA Speech-to-Text Connected</span>
            </div>
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 85 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-brand-400">✓</span> <span>Native OpenXML .pptx Multi-Layout Engine Online</span>
            </div>
          </div>
        </div>
      )}

      {/* 🦶 FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#07090e] py-12 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            QuickPitch AI Presentation Studio © 2026 • Free, Local & Private
          </div>
          <div className="flex items-center space-x-6">
            <span>Faster-Whisper CUDA</span>
            <span>Qwen 2.5 7B</span>
            <span>PptxGenJS Engine</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
