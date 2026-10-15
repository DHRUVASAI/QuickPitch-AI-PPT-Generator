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
}

const THEMES: ThemeConfig[] = [
  { id: 'monochrome-dark', name: 'Monochrome Dark', bg: '#000000', cardBg: '#111111', accent: '#FFFFFF', accentSecondary: '#888888', textPrimary: '#FFFFFF', textMuted: '#AAAAAA', border: '#222222' },
  { id: 'monochrome-light', name: 'Clean White Light', bg: '#FFFFFF', cardBg: '#F4F4F5', accent: '#000000', accentSecondary: '#444444', textPrimary: '#000000', textMuted: '#555555', border: '#E4E4E7' },
  { id: 'midnight-purple', name: 'Midnight Purple', bg: '#1E1B4B', cardBg: '#2E1065', accent: '#A78BFA', accentSecondary: '#EC4899', textPrimary: '#FAF5FF', textMuted: '#C084FC', border: '#4C1D95' },
  { id: 'emerald-growth', name: 'Emerald Growth', bg: '#064E3B', cardBg: '#022C22', accent: '#34D399', accentSecondary: '#F59E0B', textPrimary: '#ECFDF5', textMuted: '#6EE7B7', border: '#047857' },
  { id: 'warm-sunset', name: 'Warm Sunset', bg: '#18181B', cardBg: '#27272A', accent: '#F59E0B', accentSecondary: '#F43F5E', textPrimary: '#FAFAFA', textMuted: '#A1A1AA', border: '#3F3F46' },
  { id: 'cyber-blue', name: 'Cyber Blue', bg: '#0F172A', cardBg: '#1E293B', accent: '#38BDF8', accentSecondary: '#818CF8', textPrimary: '#F8FAFC', textMuted: '#94A3B8', border: '#334155' },
  { id: 'crimson-luxe', name: 'Crimson Luxe', bg: '#4C0519', cardBg: '#881337', accent: '#FB7185', accentSecondary: '#F43F5E', textPrimary: '#FFF1F2', textMuted: '#FDA4AF', border: '#9F1239' },
  { id: 'neon-matrix', name: 'Neon Matrix', bg: '#000000', cardBg: '#09090B', accent: '#22C55E', accentSecondary: '#06B6D4', textPrimary: '#FFFFFF', textMuted: '#4ADE80', border: '#15803D' },
]

// ── PRESET SHOWCASE DEMOS ─────────────────────────────────────────────────────
const PRESET_DEMOS = [
  {
    id: 'dhoni-leadership',
    title: '🏏 MS Dhoni Leadership Masterclass',
    category: 'KEYNOTE & SPEECH',
    desc: 'Decision-making under pressure, calm leadership, handling public scrutiny, and building resilient team culture.',
    mode: 'text',
    text: 'Raj Shamani and MS Dhoni in-depth interview transcript: Raj Shamani interviews cricket legend MS Dhoni on leadership, decision-making under high pressure, maintaining calmness during intense cricket matches, building a resilient team culture, handling public criticism, personal discipline, financial investments, and life after professional cricket. Main topics: 1. Leadership Philosophy & Staying Cool Under Pressure. 2. Strategic Mindset in High-Stakes Matches. 3. Handling Public Scrutiny & Media Pressure. 4. Building Team Trust & Empowering Young Players. 5. Entrepreneurship, Wealth Management, and Next Chapter.',
    theme: 'cyber-blue',
    detail: 'detailed'
  },
  {
    id: 'ai-agents',
    title: '🤖 Autonomous AI Agents Roadmap',
    category: 'TECH & STARTUP PITCH',
    desc: 'Multi-agent orchestration, tool routing, memory networks, and zero-shot reasoning architecture.',
    mode: 'text',
    text: 'Executive Pitch: Next-Gen Autonomous AI Agent Platform. Overview of multi-agent orchestration, tool routing, memory networks, and zero-shot reasoning. Architecture highlights: Agent Loop, Tool Call Interceptor, Memory Storage, and Safety Guardrails. Monetization: Pay-per-token API, enterprise self-hosted deployment, and developer marketplace.',
    theme: 'neon-matrix',
    detail: 'balanced'
  },
  {
    id: 'x402-fintech',
    title: '⚡ Fintech Micropayments Deep-Dive',
    category: 'FINTECH & WEB3',
    desc: 'HTTP 402 Payment Required status code, smart signatures, instant settlement, and API monetization.',
    mode: 'text',
    text: 'Technical Deep-Dive: Micropayment Protocol for APIs. Problem: Traditional payment gateways have high fees ($0.30 + 3%), breaking pay-per-use APIs. Solution: HTTP payment standard built on blockchain. Benefits: Instant sub-cent payments, fast finality, zero subscription friction. Architecture: Resource Server -> Payment Middleware -> Facilitator -> Settlement Layer.',
    theme: 'emerald-growth',
    detail: 'balanced'
  },
  {
    id: 'steve-jobs',
    title: '📱 Steve Jobs 2007 iPhone Keynote',
    category: 'YOUTUBE DEMO',
    desc: 'Revolutionary touch interface, iPod + Phone + Internet Communicator synthesis, and product disruption.',
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
    title: "Executive Summary & Core Vision",
    subtitle: "Strategic synthesis of source content and primary objectives",
    category: "EXECUTIVE BLUEPRINT",
    cards: [
      { card_title: "Core Thesis & Setting", points: ["Primary setting and foundational context", "Market drivers shaping key observations", "High-level strategic takeaway"] },
      { card_title: "Key Impact Pillars", points: ["Long-term value creation mechanism", "Operational resilience and Execution", "Target audience resonance & outcome"] }
    ]
  },
  {
    title: "Strategic Mindset Under Pressure",
    subtitle: "Decision-making frameworks in high-stakes environments",
    category: "STRATEGIC INSIGHTS",
    cards: [
      { card_title: "Calmness & Clarity", points: ["Filtering external noise during critical moments", "Data-informed intuition vs emotional reaction"] },
      { card_title: "Empowering Team Trust", points: ["Delegating authority to frontline executioners", "Building psychological safety in high pressure"] }
    ]
  },
  {
    title: "Future Scope & Lasting Legacy",
    subtitle: "Long-term trajectory and transformative impact",
    category: "EVOLUTION & VISION",
    cards: [
      { card_title: "Sustainable Growth", points: ["Scaling operational principles across domains", "Continuous adaptability and learning loops"] },
      { card_title: "Ultimate Takeaways", points: ["Enduring principles for leaders & innovators", "Actionable execution framework for teams"] }
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
  
  // Customization States
  const [selectedTheme, setSelectedTheme] = useState('cyber-blue')
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<'concise' | 'balanced' | 'detailed'>('balanced')
  const [selectedTone, setSelectedTone] = useState('Executive Investor Pitch')

  // UI States
  const [loading, setLoading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [allowCloudFallback, setAllowCloudFallback] = useState(false)
  const [outputLanguage, setOutputLanguage] = useState('same as video')
  const [partialNotice, setPartialNotice] = useState<string | null>(null)
  const [cloudProviderNotice, setCloudProviderNotice] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
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
    }, 28)
    return () => clearInterval(interval)
  }, [showSplash])

  // Interactive 3D tilt ref
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021'
  const activeThemeConfig = THEMES.find(t => t.id === selectedTheme) || THEMES[5]

  // Handle 3D Tilt Hover effect on live slide preview
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    setTilt({ x: (y / rect.height) * -12, y: (x / rect.width) * 12 })
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

  const getPayload = (transcribedText?: string) => {
    const base = {
      theme: selectedTheme,
      detail_level: selectedDetailLevel,
      tone: selectedTone,
      allow_cloud_fallback: allowCloudFallback,
      output_language: outputLanguage,
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
        setError('Please enter a valid YouTube URL'); return false
      }
    } else if (mode === 'text') {
      if (!rawText.trim()) { setError('Please enter or paste transcript text'); return false }
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
      setRawText('Create a 10-slide executive pitch deck covering: 1. Industry Problem & Market Gap 2. Our AI Solution Architecture 3. Target Audience & Market Size 4. Competitive Advantages 5. Monetization Strategy 6. Financial Forecast & Growth Roadmap.')
    } else {
      setRawText((prev) => `${prev.trim()}\n\nKey Strategic Focus Areas:\n- Executive Summary & Core Value Proposition\n- Technical System Architecture & Differentiators\n- Market Opportunity, ROI & Future Expansion`)
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

  // Main Generation Handler (Free - no payment required)
  const handleGenerate = async () => {
    if (!validateInput()) return
    setLoading(true); setError(''); setDone(false)
    setPartialNotice(null); setCloudProviderNotice(null)

    let transcribedText: string | undefined
    if (mode === 'audio' && audioFile) {
      setStatus('🎙️ Transcribing audio via AWS Transcribe + S3...')
      setIsTranscribing(true)
      const result = await transcribeAudioFile(audioFile)
      setIsTranscribing(false)
      if (result) {
        transcribedText = result
        setRawText(result)
        setStatus(`✅ Transcribed ${result.length} characters. Building slide deck...`)
      } else {
        setStatus('⚠️ Using filename context...')
        transcribedText = undefined
      }
    } else {
      setStatus(`Building ${selectedDetailLevel === 'detailed' ? '12-15' : '8-10'} slide deck with AI...`)
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
            body: JSON.stringify(getPayload(transcribedText)),
          });
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

          setStatus(`✅ Presentation downloaded!`);
          const blob = await response.blob();
          triggerDownload(blob)
          setDone(true);
          return;
        } catch (err: any) {
          lastError = err;
        }
      }

      setError(lastError?.message || 'Server connection failed. Ensure backend server is active.');
      setStatus('');
    } finally {
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
    <div className="min-h-screen bg-black text-white selection:bg-[#ff0000] selection:text-white relative overflow-hidden font-sans">
      
      {/* Swiss Clean Background */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-black" />

      {/* 🧭 NAVIGATION HEADER */}
      <header className="relative z-20 border-b border-[#262626] bg-black sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-[#ff0000] flex items-center justify-center text-white font-bold text-xl">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-extrabold text-2xl tracking-tight text-white">
                Quick<span className="text-[#ff0000]">Pitch</span>
              </span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 bg-[#171717] text-white border border-[#262626]">
                FREE AI
              </span>
            </div>
          </div>

          {/* Quick Stats Ticker */}
          <div className="hidden md:flex items-center space-x-6 text-xs text-neutral-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 bg-emerald-500" />
              <span>Server Active</span>
            </div>
            <div className="h-4 w-px bg-[#262626]" />
            <div>Price: <span className="text-emerald-400 font-bold">FREE</span></div>
            <div className="h-4 w-px bg-[#262626]" />
            <div>Execution: <span className="text-[#ffb703] font-bold">~3.3 sec</span></div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={triggerReplaySplash}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#262626] hover:border-white text-neutral-300 hover:text-white font-mono text-xs transition flex items-center space-x-1.5"
              title="Replay Opening Intro Animation"
            >
              <span>🎬 Replay Intro</span>
            </button>
          </div>
        </div>
      </header>

      {/* 🚀 HERO SECTION */}
      <section className="relative z-10 pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#262626] text-xs font-mono text-neutral-300 mb-8">
          <span className="px-1.5 py-0.5 bg-[#ff0000] text-white font-bold text-[10px] uppercase">FREE</span>
          <span>AI Multi-Layout Presentation Engine v2.5</span>
          <svg className="w-3.5 h-3.5 text-[#ff0000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-black tracking-tight max-w-5xl mx-auto leading-[1.05] mb-6 text-white">
          Transform YouTube, Audio & Text into <br />
          <span className="text-[#ff0000]">Investor-Grade Presentation Decks</span>
        </h1>

        <p className="text-lg sm:text-xl text-neutral-400 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
          Powered by <strong className="text-white font-semibold">AWS Transcribe + Groq Llama 3.1 AI</strong>. Generate beautifully structured .pptx files in seconds — <strong className="text-emerald-400 font-semibold">completely free</strong>.
        </p>

        {/* Feature Highlights Badges */}
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto mb-12 text-xs font-mono text-neutral-400">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#262626]">
            <span className="text-[#ff0000]">✓</span> <span>8 Dynamic Visual Themes</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#262626]">
            <span className="text-[#ff0000]">✓</span> <span>AWS Speech-to-Text Integration</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#262626]">
            <span className="text-[#ff0000]">✓</span> <span>100% Native PowerPoint (.pptx)</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#262626]">
            <span className="text-emerald-400">✓</span> <span>100% Free — No Account Required</span>
          </div>
        </div>

        {/* 🌟 PRESET DEMO GALLERY (1-CLICK TEST DRIVE) */}
        <div className="mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-4">
            ⚡ 1-Click Instant Demo Presets (Test Drive Without Typing)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left max-w-6xl mx-auto">
            {PRESET_DEMOS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className="bg-[#0a0a0a] p-4 cursor-pointer hover:border-white transition border border-[#262626] group"
              >
                <div className="text-[10px] font-mono font-bold text-[#ff0000] mb-1">{preset.category}</div>
                <div className="font-heading font-bold text-sm text-white group-hover:text-[#ff0000] transition mb-2">
                  {preset.title}
                </div>
                <div className="text-xs text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
                  {preset.desc}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                  <span className="capitalize">{preset.theme.replace('-', ' ')}</span>
                  <span className="text-white font-semibold group-hover:text-[#ff0000] group-hover:translate-x-1 transition">Load Preset →</span>
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
          <div className="lg:col-span-7 bg-[#0a0a0a] p-6 sm:p-8 border border-[#262626] relative">
            
            {/* Input Mode Selector Tabs */}
            <div className="flex bg-[#000000] p-1 border border-[#262626] mb-8">
              <button
                onClick={() => setMode('youtube')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                  mode === 'youtube'
                    ? 'bg-[#ff0000] text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>📺 YouTube Video</span>
              </button>
              <button
                onClick={() => setMode('audio')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                  mode === 'audio'
                    ? 'bg-[#ff0000] text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🎙️ Audio / Speech</span>
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex-1 py-2.5 px-4 text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                  mode === 'text'
                    ? 'bg-[#ff0000] text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>📝 Text / Prompt</span>
              </button>
            </div>

            {/* INPUT FIELDS */}

            {/* MODE 1: YOUTUBE */}
            {mode === 'youtube' && (
              <div className="space-y-4 mb-8">
                <label className="block text-xs font-mono font-semibold text-neutral-300">
                  YOUTUBE VIDEO URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-[#000000] border border-[#262626] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff0000] font-mono transition"
                  />
                  {youtubeUrl && (
                    <button
                      onClick={() => setYoutubeUrl('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Talk with Video Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0e0e11] border border-[#262626]">
                  <div className="flex items-center space-x-2 text-xs text-neutral-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
                    className="px-4 py-2 bg-[#ff0000] hover:bg-red-600 text-white font-mono text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-red-950/40"
                  >
                    <span>💬 Talk with YouTube Video</span>
                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono">AI Q&A</span>
                  </button>
                </div>

                <p className="text-xs text-neutral-500">
                  💡 Works with lectures, podcasts, interviews, product keynotes, and pitch videos. Click <strong>Talk with YouTube Video</strong> to ask our local model any questions grounded in the video transcript!
                </p>
              </div>
            )}

            {/* MODE 2: AUDIO FILE */}
            {mode === 'audio' && (
              <div className="space-y-4 mb-8">
                <label className="block text-xs font-mono font-semibold text-slate-300">
                  UPLOAD AUDIO OR SPEECH FILE (AWS TRANSCRIBE)
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-900/40 transition cursor-pointer relative group">
                  <input
                    type="file"
                    accept="audio/*,.txt,.vtt,.srt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  {audioFileName ? (
                    <div>
                      <div className="text-sm font-semibold text-emerald-400">Selected: {audioFileName}</div>
                      <div className="text-xs text-slate-500 mt-1">Click or drop new file to replace</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-200">Drag & Drop audio file here or click to browse</div>
                      <div className="text-xs text-slate-500 mt-1">Supports MP3, WAV, M4A, AAC, TXT, VTT</div>
                    </div>
                  )}
                </div>

                {/* Animated Waveform Preview */}
                {audioFileName && (
                  <div className="flex items-center justify-center space-x-1.5 py-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-xs font-mono text-indigo-400 mr-2">AWS Audio Visualizer:</span>
                    {[12, 24, 18, 32, 14, 28, 20, 36, 16, 26, 12, 30].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 bg-indigo-500 rounded-full wave-bar"
                        style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: TEXT PROMPT */}
            {mode === 'text' && (
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-semibold text-slate-300">
                    PRESENTATION PROMPT / TRANSCRIPT OUTLINE
                  </label>
                  <button
                    onClick={handleEnhancePrompt}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1"
                  >
                    <span>✨ Magic Enhance Prompt</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste meeting transcript, research notes, speech text, or prompt summary here..."
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono transition leading-relaxed"
                />
              </div>
            )}

            {/* CUSTOMIZATION OPTIONS */}
            <div className="space-y-6 pt-4 border-t border-slate-800/80">
              
              {/* Theme Selector */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 mb-3">
                  SELECT VISUAL THEME ({activeThemeConfig.name})
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      title={t.name}
                      className={`h-12 rounded-xl p-1 border-2 transition flex flex-col justify-between ${
                        selectedTheme === t.id ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/30' : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: t.bg }}
                    >
                      <div className="w-full h-3 rounded-md flex space-x-1">
                        <span className="flex-1 rounded" style={{ backgroundColor: t.accent }} />
                        <span className="flex-1 rounded" style={{ backgroundColor: t.accentSecondary }} />
                      </div>
                      <div className="text-[9px] font-mono truncate text-center" style={{ color: t.textPrimary }}>
                        {t.id.split('-')[0]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Level Selector */}
              <div>
                <label className="block text-xs font-mono font-semibold text-neutral-300 mb-3">
                  SLIDE COUNT & DETAIL LEVEL
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'concise', label: 'Concise', sub: '6-7 Slides' },
                    { id: 'balanced', label: 'Balanced', sub: '8-10 Slides' },
                    { id: 'detailed', label: 'Detailed', sub: '12-15 Slides' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setSelectedDetailLevel(level.id as any)}
                      className={`p-3 border text-left transition ${
                        selectedDetailLevel === level.id
                          ? 'bg-[#171717] border-[#ff0000] text-white'
                          : 'bg-[#000000] border-[#262626] text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      <div className="text-xs font-bold font-heading">{level.label}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{level.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Language Selector (B8) */}
              <div>
                <label className="block text-xs font-mono font-semibold text-neutral-300 mb-3">
                  OUTPUT SLIDE DECK LANGUAGE
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'same as video', label: '🌐 Same as Video', sub: 'Native Source' },
                    { id: 'English', label: '🇺🇸 English', sub: 'Standard EN' },
                    { id: 'Hindi', label: '🇮🇳 Hindi', sub: 'हिंदी' },
                    { id: 'Spanish', label: '🇪🇸 Spanish', sub: 'Español' },
                    { id: 'French', label: '🇫🇷 French', sub: 'Français' },
                    { id: 'German', label: '🇩🇪 German', sub: 'Deutsch' },
                    { id: 'Japanese', label: '🇯🇵 Japanese', sub: '日本語' },
                    { id: 'Telugu', label: '🇮🇳 Telugu', sub: 'తెలుగు' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setOutputLanguage(lang.id)}
                      className={`p-2.5 border text-left transition rounded ${
                        outputLanguage === lang.id
                          ? 'bg-[#171717] border-[#ff0000] text-white shadow-sm shadow-red-500/20'
                          : 'bg-[#000000] border-[#262626] text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      <div className="text-xs font-bold font-heading truncate">{lang.label}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{lang.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cloud Fallback Toggle (A2) */}
              <div className="mt-4 p-3.5 bg-[#0e0e11] border border-[#262626] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold font-heading text-white flex items-center space-x-2">
                    <span>☁️ Allow Cloud Fallback</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${allowCloudFallback ? 'bg-amber-900/60 text-amber-300 border border-amber-600/50' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/50'}`}>
                      {allowCloudFallback ? 'Opt-In (Groq / Gemini / AWS)' : 'Private Local Only'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                    {allowCloudFallback
                      ? 'Permits fallback to Groq / Gemini / AWS if local RTX 4060 GPU is offline or times out.'
                      : 'Never sends transcript, prompts, or audio to cloud providers. Strict local privacy.'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={allowCloudFallback}
                    onChange={(e) => setAllowCloudFallback(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff0000]"></div>
                </label>
              </div>
            </div>

            {/* ERROR DISPLAY WITH MANUAL ESCAPE HATCHES (B9) */}
            {error && (
              <div className="mt-6 p-4 bg-[#1a0000] border border-[#ff3333] text-[#ff3333] text-xs font-mono space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <span className="text-base">⚠️</span>
                    <span>{error}</span>
                  </span>
                  <button onClick={() => setError('')} className="text-[#ff3333] hover:text-white font-bold ml-2">✕</button>
                </div>
                <div className="pt-2.5 border-t border-red-900/60 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Escape Hatches:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('audio');
                      setError('');
                    }}
                    className="px-2.5 py-1 text-[11px] bg-[#262626] hover:bg-[#333333] border border-neutral-600 text-white rounded font-mono transition flex items-center space-x-1"
                  >
                    <span>🎙️ Upload Audio File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('text');
                      setError('');
                    }}
                    className="px-2.5 py-1 text-[11px] bg-[#262626] hover:bg-[#333333] border border-neutral-600 text-white rounded font-mono transition flex items-center space-x-1"
                  >
                    <span>📝 Paste Transcript Directly</span>
                  </button>
                </div>
              </div>
            )}

            {/* PARTIAL NOTICE DISPLAY (A3) */}
            {partialNotice && (
              <div className="mt-6 p-4 bg-amber-950/40 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-start justify-between space-x-3">
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

            {/* CLOUD PROVIDER NOTICE DISPLAY (A2) */}
            {cloudProviderNotice && (
              <div className="mt-6 p-4 bg-blue-950/40 border border-blue-500/60 text-blue-200 text-xs font-mono flex items-start justify-between space-x-3">
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

            {/* STATUS DISPLAY */}
            {status && (
              <div className="mt-6 p-4 bg-[#141414] border border-[#262626] text-white text-xs font-mono flex items-center space-x-3">
                <span className="w-2.5 h-2.5 bg-[#ff0000] animate-ping" />
                <span>{status}</span>
              </div>
            )}

            {/* ACTION BUTTON - Free Generate CTA */}
            <div className="mt-8">
              <button
                disabled={loading}
                onClick={handleGenerate}
                className="w-full py-4 px-6 font-heading font-bold text-base bg-[#ff0000] hover:bg-[#e60000] active:bg-[#cc0000] text-white transition disabled:opacity-50 flex items-center justify-center space-x-3 tracking-wide"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Slide Deck...</span>
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
                className="tilt-card p-6 border shadow-2xl relative min-h-[420px] flex flex-col justify-between transition-colors duration-500"
              >
                {/* Slide Category Header */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span 
                      className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5"
                      style={{ backgroundColor: activeThemeConfig.cardBg, color: activeThemeConfig.accent }}
                    >
                      {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].category}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">SLIDE 0{currentSlideIndex + 1} / 0{SAMPLE_PREVIEW_SLIDES.length}</span>
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

                  {/* Cards Mockup */}
                  <div className="grid grid-cols-2 gap-3">
                    {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].cards.map((card, ci) => (
                      <div
                        key={ci}
                        className="p-3 border text-left"
                        style={{
                          backgroundColor: activeThemeConfig.cardBg,
                          borderColor: ci === 0 ? activeThemeConfig.accent : activeThemeConfig.border,
                        }}
                      >
                        <div 
                          className="font-heading font-bold text-xs mb-2"
                          style={{ color: activeThemeConfig.textPrimary }}
                        >
                          {card.card_title}
                        </div>
                        <ul className="space-y-1">
                          {card.points.map((pt, pi) => (
                            <li 
                              key={pi} 
                              className="text-[10px] flex items-start space-x-1.5"
                              style={{ color: activeThemeConfig.textMuted }}
                            >
                              <span style={{ color: activeThemeConfig.accent }}>•</span>
                              <span className="line-clamp-2">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-[#262626] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentSlideIndex(prev => (prev - 1 + SAMPLE_PREVIEW_SLIDES.length) % SAMPLE_PREVIEW_SLIDES.length)}
                      className="w-7 h-7 bg-[#000000] border border-[#262626] flex items-center justify-center text-white hover:border-[#ff0000]"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentSlideIndex(prev => (prev + 1) % SAMPLE_PREVIEW_SLIDES.length)}
                      className="w-7 h-7 bg-[#000000] border border-[#262626] flex items-center justify-center text-white hover:border-[#ff0000]"
                    >
                      →
                    </button>
                  </div>

                  <button
                    onClick={() => setOpenSlideshowModal(true)}
                    className="text-xs font-mono font-bold px-3 py-1.5 bg-[#000000] text-white border border-[#262626] hover:border-[#ff0000] transition flex items-center space-x-1"
                  >
                    <span>🔍 Fullscreen Inspector</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Server Status Terminal */}
            <div className="bg-[#0a0a0a] p-5 border border-[#262626] font-mono text-xs text-neutral-400">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-emerald-500" />
                  <span className="font-bold text-white uppercase tracking-wider">Server Status</span>
                </div>
                <span className="text-[10px] text-neutral-500">QuickPitch AI</span>
              </div>
              
              <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
                <div className="text-neutral-500">&gt; Endpoint: POST /generate-ppt</div>
                <div className="text-neutral-500">&gt; Backend: {apiBaseUrl}</div>
                <div className="text-emerald-400">&gt; Status: Ready — Free Mode Active</div>
                <div className="text-white">&gt; Cost: FREE (No payment required)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 📊 INTERACTIVE ROI & TIME SAVED CALCULATOR */}
      <section className="relative z-10 py-16 bg-[#000000] border-y border-[#262626]">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading font-black mb-3 text-white">
            Calculate Your <span className="text-[#ff0000]">Productivity & Time Saved</span>
          </h2>
          <p className="text-neutral-400 text-sm max-w-2xl mx-auto mb-10">
            See how much time and money QuickPitch AI saves your team compared to traditional presentation design.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#0a0a0a] p-8 border border-[#262626]">
            {/* Sliders */}
            <div className="space-y-6 text-left">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-neutral-300">Decks Created Per Month</span>
                  <span className="text-[#ff0000] font-bold">{decksPerMonth} Decks</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={decksPerMonth}
                  onChange={(e) => setDecksPerMonth(parseInt(e.target.value))}
                  className="w-full accent-[#ff0000] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-neutral-300">Hours Spent Per Deck Manually</span>
                  <span className="text-[#ffb703] font-bold">{hoursPerDeck} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={hoursPerDeck}
                  onChange={(e) => setHoursPerDeck(parseInt(e.target.value))}
                  className="w-full accent-[#ffb703] cursor-pointer"
                />
              </div>
            </div>

            {/* Calculated Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-[#000000] text-center border border-[#262626]">
                <div className="text-3xl font-heading font-black text-[#ff0000] mb-1">
                  {decksPerMonth * hoursPerDeck} hrs
                </div>
                <div className="text-xs font-mono text-neutral-400">Monthly Time Saved</div>
              </div>

              <div className="p-5 bg-[#000000] text-center border border-[#262626]">
                <div className="text-3xl font-heading font-black text-white mb-1">
                  ${(decksPerMonth * hoursPerDeck * 50).toLocaleString()}
                </div>
                <div className="text-xs font-mono text-neutral-400">Est. Monthly Savings</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ❓ FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
      <section className="relative z-10 py-16 max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-heading font-black text-center mb-10 text-white">
          Frequently Asked <span className="text-[#ff0000]">Questions</span>
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
              a: 'YouTube transcripts are parsed automatically. For raw audio files (MP3/WAV), QuickPitch uploads the audio securely to AWS S3 and runs AWS Transcribe speech-to-text before handing the transcript to Groq AI.'
            },
            {
              q: 'What AI models power the presentation generation?',
              a: 'QuickPitch uses a multi-provider AI pipeline: Groq LLaMA 3.1 8B for ultra-fast inference, with fallback to Groq 70B, OpenAI GPT-4o, and Google Gemini for maximum reliability.'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              className="bg-[#0a0a0a] p-5 border border-[#262626] cursor-pointer transition hover:border-white"
            >
              <div className="flex items-center justify-between font-heading font-bold text-base text-white">
                <span>{item.q}</span>
                <span className="text-[#ff0000] text-xl font-mono">{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && (
                <div className="mt-3 text-xs text-neutral-400 leading-relaxed font-sans border-t border-[#262626] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 🚪 FULLSCREEN SLIDESHOW INSPECTOR MODAL */}
      {openSlideshowModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-5xl bg-[#0a0a0a] p-8 border border-[#262626] flex flex-col justify-between min-h-[600px]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 bg-[#ff0000] text-white font-mono text-xs font-bold">
                  LIVE SLIDESHOW INSPECTOR
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  Slide {currentSlideIndex + 1} of {SAMPLE_PREVIEW_SLIDES.length}
                </span>
              </div>
              <button
                onClick={() => setOpenSlideshowModal(false)}
                className="text-neutral-400 hover:text-white text-base font-bold font-mono"
              >
                ✕ ESC
              </button>
            </div>

            {/* Slide Body */}
            <div className="my-8 text-center max-w-3xl mx-auto">
              <div className="text-xs font-mono font-bold text-[#ff0000] uppercase tracking-widest mb-2">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].category}
              </div>
              <h2 className="text-3xl font-heading font-black text-white mb-3">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].title}
              </h2>
              <p className="text-sm text-neutral-400 mb-8">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].subtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                {SAMPLE_PREVIEW_SLIDES[currentSlideIndex].cards.map((card, ci) => (
                  <div key={ci} className="bg-[#000000] p-5 border border-[#262626]">
                    <div className="font-heading font-bold text-sm text-white mb-3">{card.card_title}</div>
                    <ul className="space-y-2 text-xs text-neutral-400">
                      {card.points.map((pt, pi) => (
                        <li key={pi} className="flex items-start space-x-2">
                          <span className="text-[#ff0000]">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-[#262626] text-xs font-mono">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCurrentSlideIndex(prev => (prev - 1 + SAMPLE_PREVIEW_SLIDES.length) % SAMPLE_PREVIEW_SLIDES.length)}
                  className="px-4 py-2 bg-[#171717] border border-[#262626] text-white hover:border-[#ff0000]"
                >
                  ← Previous Slide
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(prev => (prev + 1) % SAMPLE_PREVIEW_SLIDES.length)}
                  className="px-4 py-2 bg-[#171717] border border-[#262626] text-white hover:border-[#ff0000]"
                >
                  Next Slide →
                </button>
              </div>

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
          className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center transition-all duration-700 ${
            splashFading ? 'scale-105 opacity-0 blur-lg pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          {/* Central Logo & Pulse Icon */}
          <div className="relative z-10 mb-8">
            <div className="w-20 h-20 bg-[#ff0000] flex items-center justify-center text-white font-bold text-2xl">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="relative z-10 font-heading font-black text-4xl sm:text-5xl text-white mb-2 tracking-tight">
            Quick<span className="text-[#ff0000]">Pitch</span> AI
          </h1>
          <p className="relative z-10 text-xs font-mono text-neutral-400 mb-8 tracking-widest uppercase">
            Free AI Presentation Engine
          </p>

          {/* Progress Bar & Percentage */}
          <div className="relative z-10 w-full max-w-sm bg-[#171717] h-2 border border-[#262626] mb-4 overflow-hidden">
            <div 
              className="h-full bg-[#ff0000] transition-all duration-75 ease-out"
              style={{ width: `${splashProgress}%` }}
            />
          </div>

          <div className="relative z-10 font-mono text-sm font-bold text-[#ff0000] mb-8">
            Initializing Engine... <span className="text-white">{splashProgress}%</span>
          </div>

          {/* System Checklist Badges */}
          <div className="relative z-10 flex flex-col space-y-2 text-xs font-mono text-neutral-400">
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 20 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-[#ff0000]">✓</span> <span>AI Neural Synthesizer Ready</span>
            </div>
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 55 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-[#ff0000]">✓</span> <span>AWS Speech-to-Text Transcribe Connected</span>
            </div>
            <div className={`transition-all duration-300 flex items-center space-x-2 ${splashProgress >= 85 ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2'}`}>
              <span className="text-[#ff0000]">✓</span> <span>Groq Llama 3.1 Neural Synthesizer Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* 🦶 FOOTER */}
      <footer className="relative z-10 border-t border-[#262626] bg-black py-12 text-center text-xs font-mono text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            QuickPitch AI Presentation Generator © 2026 • Free & Open
          </div>
          <div className="flex items-center space-x-6">
            <span>AWS Transcribe</span>
            <span>Groq Llama 3.1</span>
            <span>PptxGenJS Engine</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
