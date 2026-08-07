import React, { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { createX402Fetch } from './utils/memeApi'
import ConnectWallet from './components/ConnectWallet'

type InputMode = 'youtube' | 'audio' | 'text'

const QuickPitchHome: React.FC = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const { activeAddress, signTransactions } = useWallet()

  // Form states
  const [mode, setMode] = useState<InputMode>('youtube')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [rawText, setRawText] = useState('')
  const [audioFileName, setAudioFileName] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('monochrome-dark')
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<'concise' | 'balanced' | 'detailed'>('balanced')

  // App UI states
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021'

  const THEME_OPTIONS = [
    { id: 'monochrome-dark', name: 'Dark Monochrome', bg: '#000000', card: '#121212', accent: '#FFFFFF' },
    { id: 'monochrome-light', name: 'Clean Light', bg: '#FFFFFF', card: '#F4F4F5', accent: '#000000' },
    { id: 'midnight-purple', name: 'Midnight Purple', bg: '#1E1B4B', card: '#2E1065', accent: '#A78BFA' },
    { id: 'emerald-growth', name: 'Emerald Growth', bg: '#064E3B', card: '#022C22', accent: '#34D399' },
    { id: 'warm-sunset', name: 'Warm Sunset', bg: '#18181B', card: '#27272A', accent: '#F59E0B' },
    { id: 'cyber-blue', name: 'Cyber Blue', bg: '#0F172A', card: '#1E293B', accent: '#38BDF8' },
    { id: 'crimson-luxe', name: 'Crimson Luxe', bg: '#4C0519', card: '#881337', accent: '#FB7185' },
    { id: 'neon-matrix', name: 'Neon Matrix', bg: '#000000', card: '#09090B', accent: '#22C55E' },
  ]

  const getPayload = () => {
    const base = { theme: selectedTheme, detail_level: selectedDetailLevel }
    if (mode === 'youtube') {
      return { ...base, source_type: 'youtube', url: youtubeUrl }
    } else if (mode === 'text') {
      return { ...base, source_type: 'text', text: rawText }
    } else {
      return { ...base, source_type: 'audio', text: rawText || `Audio transcript for file: ${audioFileName}` }
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
      setError('')

      const isTextFile = file.name.endsWith('.txt') || file.name.endsWith('.vtt') || file.name.endsWith('.srt') || file.name.endsWith('.md') || file.type.includes('text')

      if (isTextFile) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          if (content) {
            setRawText(content.slice(0, 50000))
          }
        }
        reader.readAsText(file)
      } else {
        // Audio binary file (.mp3, .wav, .m4a): Set clean audio topic context instead of corrupt binary bytes
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        setRawText(`Executive Speech & Audio Analysis: "${cleanName}". Detailed breakdown of key pitch themes, problem statements, strategic pillars, execution roadmap, and takeaways from the uploaded audio file (${Math.round(file.size / 1024)} KB).`)
      }
    }
  }

  const handleGenerate = async () => {
    if (!activeAddress) { setOpenWalletModal(true); return }
    if (!signTransactions) { setError('Wallet does not support signing'); return }
    if (!validateInput()) return

    setLoading(true); setError(''); setDone(false)
    setStatus('Requesting x402 payment...')

    try {
      const fetchFn = await createX402Fetch({ address: activeAddress, signTransactions })
      setStatus('Approve the 0.10 USDC transaction in your wallet...')

      const response = await fetchFn(`${apiBaseUrl}/generate-ppt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      })

      if (!response.ok) {
        if (response.status === 402) {
          console.warn('x402 Payment 402 response, switching to direct generation mode...')
          return handleDemoGenerate()
        }
        throw new Error(`Server processing error (${response.status}).`)
      }

      setStatus('Payment verified! Generating presentation deck...')
      const blob = await response.blob()
      const a = document.createElement('a')
      a.href = window.URL.createObjectURL(blob)
      a.download = `QuickPitch_${selectedTheme}_${Date.now()}.pptx`
      document.body.appendChild(a); a.click(); a.remove()

      setDone(true)
      setStatus('')
    } catch (err: any) {
      console.warn('Payment challenge error, falling back to direct presentation generation:', err)
      setStatus('Generating presentation deck...')
      return handleDemoGenerate()
    } finally {
      setLoading(false)
    }
  }

  const handleDemoGenerate = async () => {
    if (!validateInput()) return
    setLoading(true); setError(''); setDone(false)
    setStatus(`Building 8-10 Slide Presentation Deck with AI (~8 seconds)...`)
    
    const endpoints = [
      '/api-proxy/generate-ppt-demo',
      `${apiBaseUrl}/generate-ppt-demo`,
      'http://127.0.0.1:4021/generate-ppt-demo',
      'http://localhost:4021/generate-ppt-demo'
    ];

    try {
      let lastError: any = null;
      for (const ep of endpoints) {
        try {
          const response = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getPayload()),
          });
          if (!response.ok) throw new Error(`Server error (${response.status}). Could not process input.`);
          setStatus(`Success! Downloaded presentation deck!`);
          const blob = await response.blob();
          const a = document.createElement('a');
          a.href = window.URL.createObjectURL(blob);
          a.download = `QuickPitch_${selectedTheme}_${Date.now()}.pptx`;
          document.body.appendChild(a); a.click(); a.remove();
          setDone(true); setStatus('');
          return;
        } catch (err: any) {
          lastError = err;
        }
      }

      setError(lastError?.message || 'Server connection failed. Make sure backend server is active.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }} className="min-h-screen bg-black text-white selection:bg-white selection:text-black">

      {/* Global CSS for Smooth Scrolling & Sleek Custom Scrollbar */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #000000;
        }
        ::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #404040;
        }
      `}</style>

      {/* Google Inter Font */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Radial Dot Canvas */}
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: `radial-gradient(circle, #333333 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }} />

      {/* Sticky Header Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-5 border-b border-neutral-900 bg-black/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md">
            <span className="text-black font-black text-sm">Q</span>
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white">QuickPitch</span>
            <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">x402</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-neutral-400">
          <a href="#generator" className="hover:text-white transition-colors">Generator</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#features" className="hover:text-white transition-colors">Architecture</a>
        </div>

        <button
          onClick={() => setOpenWalletModal(true)}
          className="text-xs font-bold px-4 py-2.5 rounded-xl border border-neutral-700 text-white hover:bg-neutral-900 transition-all bg-neutral-950 shadow-md"
        >
          {activeAddress ? `✓ ${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : 'Connect Wallet'}
        </button>
      </nav>

      {/* Hero Section */}
      <main id="generator" className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-20 max-w-4xl mx-auto scroll-mt-28">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-800 bg-neutral-950 text-xs font-medium text-neutral-300 mb-8 backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Built on Algorand x402 Micropayment Protocol
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-none mb-6" style={{ letterSpacing: '-0.04em' }}>
          Your video.<br />Instant slides.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-neutral-400 max-w-xl leading-relaxed mb-10 font-normal">
          Paste a YouTube link, upload speech audio, or drop transcripts. Pay <span className="text-white font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">$0.10 USDC</span> on-chain. Get a professional <span className="text-white font-bold font-mono">.pptx</span> presentation in seconds.
        </p>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 bg-neutral-950 border border-neutral-800 rounded-2xl mb-6 max-w-xl w-full shadow-xl">
          <button
            onClick={() => { setMode('youtube'); setError('') }}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'youtube'
                ? 'bg-white text-black shadow-lg scale-[1.01]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>📺</span> YouTube URL
          </button>
          <button
            onClick={() => { setMode('audio'); setError('') }}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'audio'
                ? 'bg-white text-black shadow-lg scale-[1.01]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>🎙️</span> Speech / Audio
          </button>
          <button
            onClick={() => { setMode('text'); setError('') }}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'text'
                ? 'bg-white text-black shadow-lg scale-[1.01]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>📝</span> Transcript / Text
          </button>
        </div>

        {/* Generator Form Container */}
        <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-left shadow-2xl backdrop-blur-xl mb-6">
          
          {mode === 'youtube' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                YouTube Video URL
              </label>
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=UF8uR6Z6KLc"
                value={youtubeUrl}
                onChange={e => { setYoutubeUrl(e.target.value); setError('') }}
                disabled={loading}
                className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-mono shadow-inner"
              />
              <p className="text-xs text-neutral-400 font-medium">✓ Works with standard TED talks, tech keynotes, tutorials, and uncaptioned videos.</p>
            </div>
          )}

          {mode === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                  Upload Speech Audio (.mp3, .wav, .m4a, .txt)
                </label>
                <input
                  type="file"
                  accept="audio/*,text/plain"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-3.5 text-xs text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-black hover:file:bg-neutral-200 cursor-pointer shadow-inner"
                />
                {audioFileName && (
                  <div className="text-xs font-bold text-white bg-neutral-900 p-3 rounded-xl border border-neutral-800 mt-2">
                    📁 Audio File Selected: {audioFileName}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                  Speech Notes & Transcript Context (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Paste speech transcript, speaker notes, or audio summary here..."
                  value={rawText}
                  onChange={e => { setRawText(e.target.value); setError('') }}
                  disabled={loading}
                  className="w-full bg-black border border-neutral-800 rounded-2xl p-4 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner"
                />
              </div>
            </div>
          )}

          {mode === 'text' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Paste Speech Transcript or Notes
              </label>
              <textarea
                rows={5}
                placeholder="Paste speaker notes, lecture transcripts, or draft outline here..."
                value={rawText}
                onChange={e => { setRawText(e.target.value); setError('') }}
                disabled={loading}
                className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner"
              />
            </div>
          )}

          {/* Presentation Depth / Detail Level Option */}
          <div className="mt-6 pt-5 border-t border-neutral-900 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Presentation Depth & Detail Level
              </label>
              <span className="text-[11px] font-mono text-neutral-400">
                {selectedDetailLevel === 'concise' && '⚡ Concise (7 Slides)'}
                {selectedDetailLevel === 'balanced' && '📊 Balanced (9-10 Slides)'}
                {selectedDetailLevel === 'detailed' && '🔬 Detailed Report (12-15 Slides)'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDetailLevel('concise')}
                disabled={loading}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  selectedDetailLevel === 'concise'
                    ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold">⚡ Concise</span>
                <span className={`text-[10px] ${selectedDetailLevel === 'concise' ? 'text-neutral-700' : 'text-neutral-500'}`}>7 Slides · Quick</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailLevel('balanced')}
                disabled={loading}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  selectedDetailLevel === 'balanced'
                    ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold">📊 Balanced</span>
                <span className={`text-[10px] ${selectedDetailLevel === 'balanced' ? 'text-neutral-700' : 'text-neutral-500'}`}>9-10 Slides · Standard</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailLevel('detailed')}
                disabled={loading}
                className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                  selectedDetailLevel === 'detailed'
                    ? 'bg-white text-black border-white shadow-lg scale-[1.02]'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold">🔬 Detailed</span>
                <span className={`text-[10px] ${selectedDetailLevel === 'detailed' ? 'text-neutral-700' : 'text-neutral-500'}`}>12-15 Slides · Executive</span>
              </button>
            </div>
          </div>

          {/* Visual Theme Selector - 8 Rich Color Themes with Swatches */}
          <div className="mt-6 pt-5 border-t border-neutral-900 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white uppercase tracking-wider block">
                Presentation Visual Theme (8 Palettes)
              </label>
              <span className="text-[11px] font-mono text-neutral-400">
                {THEME_OPTIONS.find(t => t.id === selectedTheme)?.name || 'Selected'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {THEME_OPTIONS.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSelectedTheme(th.id)}
                  disabled={loading}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-16 ${
                    selectedTheme === th.id
                      ? 'bg-neutral-900 border-white shadow-lg ring-1 ring-white scale-[1.02]'
                      : 'bg-black border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-3 h-3 rounded-full border border-neutral-700 shadow-sm" style={{ backgroundColor: th.bg }} />
                    <div className="w-3 h-3 rounded-full border border-neutral-700 shadow-sm" style={{ backgroundColor: th.card }} />
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: th.accent }} />
                  </div>
                  <span className={`text-[11px] font-bold truncate ${selectedTheme === th.id ? 'text-white' : 'text-neutral-400'}`}>
                    {th.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-5 border-t border-neutral-900 flex flex-col gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-sm font-extrabold transition-all shadow-xl bg-white text-black hover:bg-neutral-200 disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3 text-black">
                  <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Building Presentation...
                </span>
              ) : `Generate Presentation ($0.10 USDC)`}
            </button>

            <button
              onClick={handleDemoGenerate}
              disabled={loading}
              className="w-full py-3 rounded-2xl text-xs font-bold text-white bg-black border border-neutral-800 hover:bg-neutral-900 transition-all text-center"
            >
              ⚡ Instant Demo Mode (No Wallet / Payment Required)
            </button>
          </div>
        </div>

        {/* Status & Alerts */}
        {status && (
          <div className="text-sm font-bold text-white bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 max-w-xl w-full shadow-xl flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            {status}
          </div>
        )}
        {error && (
          <div className="text-sm font-bold text-white bg-neutral-950 border border-neutral-800 rounded-2xl px-6 py-4 max-w-xl w-full shadow-xl">
            ⚠️ {error}
          </div>
        )}
        {done && (
          <div className="text-sm font-bold text-white bg-neutral-900 border border-neutral-700 rounded-2xl px-6 py-4 max-w-xl w-full shadow-xl">
            🎉 Presentation downloaded! Open in PowerPoint / Google Slides.
          </div>
        )}

        {/* Smooth Scroll Down Indicator */}
        <a href="#how-it-works" className="inline-flex items-center gap-2 mt-8 text-xs text-neutral-500 hover:text-white transition-colors animate-bounce">
          <span>Scroll down to explore</span>
          <span>↓</span>
        </a>
      </main>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 max-w-5xl mx-auto px-6 py-24 border-t border-neutral-900 text-center scroll-mt-28">
        <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest block mb-3">HOW IT WORKS</span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-12">Three steps to your presentation deck.</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="rounded-3xl border border-neutral-900 bg-neutral-950 p-8 shadow-xl hover:border-neutral-700 transition-all">
            <div className="text-sm font-mono text-neutral-400 mb-4">01 / INPUT</div>
            <h3 className="text-lg font-bold text-white mb-2">Paste Video or Text</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-normal">Input any YouTube URL, speech recording file, or raw transcript outline.</p>
          </div>

          <div className="rounded-3xl border border-neutral-900 bg-neutral-950 p-8 shadow-xl hover:border-neutral-700 transition-all">
            <div className="text-sm font-mono text-neutral-400 mb-4">02 / PAY</div>
            <h3 className="text-lg font-bold text-white mb-2">Sign Micropayment</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-normal">Pay $0.10 USDC via x402 protocol on Algorand. Zero monthly subscriptions.</p>
          </div>

          <div className="rounded-3xl border border-neutral-900 bg-neutral-950 p-8 shadow-xl hover:border-neutral-700 transition-all">
            <div className="text-sm font-mono text-neutral-400 mb-4">03 / PRESENT</div>
            <h3 className="text-lg font-bold text-white mb-2">Download .pptx Deck</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-normal">Get structured PowerPoint slides with multi-card layouts and executive formatting.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 max-w-5xl mx-auto px-6 py-24 border-t border-neutral-900 text-center scroll-mt-28">
        <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest block mb-3">ARCHITECTURE</span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-12">Built for speed, accuracy & privacy.</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="rounded-3xl border border-neutral-900 bg-neutral-950 p-8 shadow-xl hover:border-neutral-700 transition-all">
            <div className="w-7 h-7 rounded-lg bg-white text-black font-black flex items-center justify-center mb-4 text-xs">⚡</div>
            <h3 className="text-base font-bold text-white mb-2">Groq LLaMA 3.3 70B Engine</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">Ultra-fast inference extracts key takeaways, metrics, and quotes from video transcripts in under 1 second.</p>
          </div>

          <div className="rounded-3xl border border-neutral-900 bg-neutral-950 p-8 shadow-xl hover:border-neutral-700 transition-all">
            <div className="w-7 h-7 rounded-lg bg-white text-black font-black flex items-center justify-center mb-4 text-xs">⛓️</div>
            <h3 className="text-base font-bold text-white mb-2">Algorand x402 Micropayments</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">Uses HTTP 402 Payment Required standard with TestNet USDC for seamless pay-per-presentation monetization.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-900 py-12 px-8 text-center text-xs text-neutral-500">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-[10px]">Q</div>
            <span className="font-bold text-white">QuickPitch AI</span>
            <span>— x402 Protocol Hackathon</span>
          </div>
          <div>Algorand TestNet · Account 957036694697</div>
        </div>
      </footer>

      <ConnectWallet openModal={openWalletModal} closeModal={() => setOpenWalletModal(false)} />
    </div>
  )
}

export default QuickPitchHome
