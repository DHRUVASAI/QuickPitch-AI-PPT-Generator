import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TalkWithYouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  apiBaseUrl: string;
}

export const TalkWithYouTubeModal: React.FC<TalkWithYouTubeModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  apiBaseUrl,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([
    'What are the core insights and takeaways of this video?',
    'Summarize the primary problems and solutions discussed.',
    'What specific data, examples, or quotes were shared?'
  ]);
  const [error, setError] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnswering]);

  // Load transcript as soon as modal opens or videoUrl changes
  useEffect(() => {
    if (!isOpen || !videoUrl) return;

    let isMounted = true;
    const fetchTranscript = async () => {
      setIsLoadingTranscript(true);
      setError('');
      try {
        const endpoints = [
          '/api-proxy/youtube/load-transcript',
          `${apiBaseUrl}/youtube/load-transcript`,
          'http://127.0.0.1:4021/youtube/load-transcript',
          'http://localhost:4021/youtube/load-transcript',
        ];

        let resData: any = null;
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: videoUrl }),
            });
            if (resp.ok) {
              resData = await resp.json();
              break;
            }
          } catch {
            // try next endpoint
          }
        }

        if (!isMounted) return;

        if (resData && resData.success) {
          setVideoTitle(resData.title || 'YouTube Video');
          setCharCount(resData.charCount || 0);
          if (resData.sampleQuestions?.length) {
            setSampleQuestions(resData.sampleQuestions);
          }
          setMessages([
            {
              id: 'init-msg',
              role: 'assistant',
              content: `🎙️ **Transcript Loaded (${(resData.charCount || 0).toLocaleString()} characters)**\n\nI have indexed the full transcript for **"${resData.title || 'this video'}"** directly into my local neural memory (**Qwen 2.5 7B**).\n\nAsk me anything about what was said, key quotes, timestamps, or deep takeaways!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else {
          setError('Could not load automated transcript for this video. You can still ask questions and I will answer using available metadata!');
          setMessages([
            {
              id: 'init-err',
              role: 'assistant',
              content: `I'm connected to the video context for: **${videoUrl}**.\n\nAsk me any question and I'll analyze it for you!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to connect to YouTube transcript service');
      } finally {
        if (isMounted) setIsLoadingTranscript(false);
      }
    };

    fetchTranscript();

    return () => {
      isMounted = false;
    };
  }, [isOpen, videoUrl, apiBaseUrl]);

  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || inputQuestion).trim();
    if (!question || isAnswering) return;

    setInputQuestion('');
    setError('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAnswering(true);

    try {
      const endpoints = [
        '/api-proxy/youtube/chat',
        `${apiBaseUrl}/youtube/chat`,
        'http://127.0.0.1:4021/youtube/chat',
        'http://localhost:4021/youtube/chat',
      ];

      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let replyText = '';
      let modelUsed = 'Qwen 2.5 7B (Local GPU)';

      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: videoUrl,
              question,
              history: historyPayload,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.answer) {
              replyText = data.answer;
              if (data.modelUsed) modelUsed = data.modelUsed;
              break;
            }
          }
        } catch {
          // try next
        }
      }

      if (!replyText) {
        throw new Error('Failed to get answer from local AI model.');
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setError(err.message || 'Error communicating with AI model');
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message || 'Unable to retrieve answer. Please make sure Ollama is running on port 11434 with qwen2.5:7b.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnswering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-[#09090b] border border-[#27272a] shadow-2xl flex flex-col h-[85vh] max-h-[820px] overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111113] border-b border-[#27272a]">
          <div className="flex items-center space-x-3 truncate mr-4">
            <div className="w-8 h-8 rounded-lg bg-[#ff0000]/10 border border-[#ff0000]/30 flex items-center justify-center text-[#ff0000] font-bold shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Talk with YouTube Video
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                  Qwen 2.5 7B Local GPU (:11434)
                </span>
              </div>
              <div className="text-xs text-neutral-400 truncate max-w-md sm:max-w-xl font-mono">
                {videoTitle || videoUrl}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 px-3 bg-[#18181b] border border-[#27272a] text-neutral-400 hover:text-white hover:border-[#ff0000] text-xs font-mono transition"
            >
              ✕ ESC
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-2 bg-[#09090b] border-b border-[#27272a] flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Grounding: <strong>Full Video Transcript</strong> ({charCount > 0 ? `${charCount.toLocaleString()} chars` : 'Syncing...'})</span>
          </div>
          {isLoadingTranscript && (
            <div className="text-yellow-400 flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Ingesting transcript...</span>
            </div>
          )}
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-2 mb-1 px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  {msg.role === 'user' ? '👤 You' : '🤖 Qwen 2.5 7B'}
                </span>
                <span className="text-[10px] font-mono text-neutral-600">{msg.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] sm:max-w-[78%] p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#1e1e24] text-white border border-[#3f3f46] rounded-tl-xl rounded-tr-sm rounded-bl-xl rounded-br-xl'
                    : 'bg-[#121215] text-neutral-200 border border-[#27272a] rounded-tl-sm rounded-tr-xl rounded-bl-xl rounded-br-xl font-sans'
                }`}
              >
                <div className="whitespace-pre-wrap space-y-2 prose-invert text-xs sm:text-sm">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isAnswering && (
            <div className="flex flex-col items-start">
              <div className="flex items-center space-x-2 mb-1 px-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#ff0000]">
                  🤖 Qwen 2.5 7B (Thinking...)
                </span>
              </div>
              <div className="bg-[#121215] p-3 border border-[#27272a] rounded-xl flex items-center space-x-2 text-xs font-mono text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-[#ff0000] animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-[#ff0000] animate-bounce [animation-delay:0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-[#ff0000] animate-bounce [animation-delay:0.3s]"></span>
                <span className="ml-2">Analyzing transcript on local GPU...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Quick Prompt Chips */}
        {messages.length <= 2 && sampleQuestions.length > 0 && (
          <div className="px-6 py-2 bg-[#09090b] border-t border-[#1e1e24] flex flex-wrap gap-2">
            <span className="text-[11px] font-mono text-neutral-500 py-1">Quick Prompts:</span>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isAnswering || isLoadingTranscript}
                className="text-xs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-neutral-500 text-neutral-300 hover:text-white px-3 py-1 rounded transition text-left truncate max-w-xs"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-[#111113] border-t border-[#27272a]">
          {error && (
            <div className="mb-2 text-xs font-mono text-red-400 bg-red-950/40 p-2 border border-red-900 rounded">
              ⚠️ {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-3"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask anything about this video (e.g., 'What were the 3 key arguments made?')..."
              disabled={isAnswering || isLoadingTranscript}
              className="flex-1 bg-[#09090b] border border-[#27272a] focus:border-[#ff0000] px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none font-sans transition"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isAnswering || isLoadingTranscript}
              className="px-6 py-3 bg-[#ff0000] hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-[#ff0000] text-white font-mono text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2 shrink-0"
            >
              <span>Ask AI</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
