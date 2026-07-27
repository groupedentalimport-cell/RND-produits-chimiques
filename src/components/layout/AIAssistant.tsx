'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Brain, Sparkles, MessageCircle, AlertCircle, RefreshCw, Send,
  Database, ChevronRight, Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Context-aware quick prompts ───────────────────────────────────────────
const QPROMPTS = [
  "What's the stability of Aspirin?",
  'Which molecules have critical risk?',
  'Compare Aspirin vs Ibuprofen stability',
  'Show studies under review',
  'What are ICH Q1A guidelines?',
]

// Static fallback follow-ups; augmented based on the AI response content.
const FOLLOW_UPS_DEFAULT = [
  'Explain hydrolysis degradation',
  'What is ICH Q1A?',
  'How does Q10 affect shelf life?',
]

interface CMsg {
  role: 'user' | 'assistant'
  content: string
  ts: number
  // Suggested follow-up questions (only populated for assistant messages)
  followUps?: string[]
}

// ── Simple Markdown Renderer ──────────────────────────────────────────────
// Handles: fenced code blocks (```), inline `code`, **bold**, *italic*,
// bullet lists (- or *), numbered lists (1.), and paragraph breaks.
function MarkdownView({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const parts = text.split(/```/)
    const out: Array<{ type: 'code' | 'text'; content: string }> = []
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        // Code block — strip optional leading language tag (e.g. "js\n...")
        const trimmed = p.replace(/^[a-zA-Z0-9]+\n/, '').replace(/\n$/, '')
        out.push({ type: 'code', content: trimmed })
      } else if (p.trim().length > 0) {
        out.push({ type: 'text', content: p })
      }
    })
    return out
  }, [text])

  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg bg-zinc-950 text-zinc-100 dark:bg-zinc-900 p-2.5 text-[11px] leading-relaxed font-mono border border-zinc-800"
          >
            <code>{b.content}</code>
          </pre>
        ) : (
          <TextBlock key={i} content={b.content} />
        )
      )}
    </div>
  )
}

function TextBlock({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return
    if (listType === 'ol') {
      elements.push(
        <ol key={key} className="list-decimal ml-5 space-y-1 my-1">
          {listBuffer}
        </ol>
      )
    } else {
      elements.push(
        <ul key={key} className="list-disc ml-5 space-y-1 my-1 marker:text-emerald-500">
          {listBuffer}
        </ul>
      )
    }
    listBuffer = []
    listType = null
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/\s+$/, '')
    if (line.trim() === '') {
      flushList(`l-${idx}`)
      return
    }
    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/)
    if (olMatch) {
      if (listType && listType !== 'ol') flushList(`l-${idx}-x`)
      listType = 'ol'
      listBuffer.push(<li key={`li-${idx}`}>{renderInline(olMatch[1])}</li>)
      return
    }
    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (ulMatch) {
      if (listType && listType !== 'ul') flushList(`l-${idx}-x`)
      listType = 'ul'
      listBuffer.push(<li key={`li-${idx}`}>{renderInline(ulMatch[1])}</li>)
      return
    }
    flushList(`l-${idx}`)
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInline(line)}
      </p>
    )
  })
  flushList('l-final')

  return <div className="space-y-1">{elements}</div>
}

// Render inline markdown: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Tokenize via regex: capture groups for **bold**, *italic*, `code`
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[2] != null) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      )
    } else if (match[3] != null) {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {match[3]}
        </em>
      )
    } else if (match[4] != null) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-zinc-200/70 dark:bg-zinc-800 px-1 py-0.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300"
        >
          {match[4]}
        </code>
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

// ── Suggested Follow-Up Generator ─────────────────────────────────────────
// Generates 2-3 contextual follow-up questions based on the AI response.
function generateFollowUps(response: string): string[] {
  const lower = response.toLowerCase()
  const suggestions: string[] = []

  if (lower.includes('aspirin') || lower.includes('acetylsalicylic')) {
    suggestions.push('What are Aspirin degradation products?')
  }
  if (lower.includes('ibuprofen')) {
    suggestions.push('How is Ibuprofen stored?')
  }
  if (lower.includes('hydrolysis')) {
    suggestions.push('How can I prevent hydrolysis?')
  }
  if (lower.includes('oxidation')) {
    suggestions.push('Which antioxidants prevent oxidation?')
  }
  if (lower.includes('ich') || lower.includes('q1a') || lower.includes('guideline')) {
    suggestions.push('What are ICH Q1B photostability requirements?')
  }
  if (lower.includes('shelf life') || lower.includes('shelf-life')) {
    suggestions.push('How is shelf life predicted?')
  }
  if (lower.includes('risk') || lower.includes('hazard')) {
    suggestions.push('Which molecules have critical risk?')
  }
  if (lower.includes('study') || lower.includes('studies')) {
    suggestions.push('Show studies under review')
  }
  if (lower.includes('temperature') || lower.includes('storage')) {
    suggestions.push('What are ICH climate zones?')
  }
  if (lower.includes('q10') || lower.includes('arrhenius')) {
    suggestions.push('How does Q10 affect shelf life?')
  }
  if (lower.includes('degradation') || lower.includes('degrade')) {
    suggestions.push('Explain hydrolysis degradation')
  }

  // Deduplicate and limit
  const unique = Array.from(new Set(suggestions))
  const result = unique.length >= 2 ? unique.slice(0, 3) : [...unique, ...FOLLOW_UPS_DEFAULT].slice(0, 3)
  return result.slice(0, 3)
}

export function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<CMsg[]>([])
  const [input, setInput] = useState('')
  const [ld, setLd] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)
  const [probed, setProbed] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Probe the chat endpoint once on mount to determine whether the DB
  // context is connected. We send a tiny "ping" message and inspect the
  // returned `hasData` flag. If it errors, we just leave hasData=false.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'ping' }),
        })
        if (!r.ok) return
        const data = await r.json()
        if (!cancelled && typeof data.hasData === 'boolean') {
          setHasData(data.hasData)
        }
      } catch {
        /* ignore — UI still works without probe */
      } finally {
        if (!cancelled) setProbed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const send = useCallback(async (t: string) => {
    if (!t.trim() || ld) return
    const userText = t.trim()
    setMsgs((p) => [...p, { role: 'user', content: userText, ts: Date.now() }])
    setInput('')
    setLd(true)
    setErr(null)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })
      if (!r.ok) {
        const errData = await r.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errData.error || `HTTP ${r.status}`)
      }
      const data = await r.json()
      if (typeof data.hasData === 'boolean') setHasData(data.hasData)
      const followUps = generateFollowUps(data.response || '')
      setMsgs((p) => [
        ...p,
        { role: 'assistant', content: data.response, ts: Date.now(), followUps },
      ])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLd(false)
    }
  }, [ld])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  return (
    <>
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center"
        aria-label="AI Assistant"
      >
        {open ? <X className="size-5" /> : <Brain className="size-5" />}
        {!open && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-gradient-to-br from-emerald-500 to-teal-600" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-500/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                  <Brain className="size-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    ChemStab AI
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Stability expert</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Context badge */}
                <div
                  className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  title={
                    probed
                      ? hasData
                        ? 'Live molecule & study data attached to every response'
                        : 'Database context unavailable'
                      : 'Connecting to database…'
                  }
                  style={{
                    borderColor: hasData ? 'rgb(16 185 129 / 0.4)' : 'rgb(148 163 184 / 0.4)',
                    background: hasData ? 'rgb(16 185 129 / 0.08)' : 'rgb(148 163 184 / 0.08)',
                    color: hasData ? 'rgb(5 150 105)' : 'rgb(100 116 139)',
                  }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {hasData && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        hasData ? 'bg-emerald-500' : probed ? 'bg-slate-400' : 'bg-amber-400'
                      }`}
                    />
                  </span>
                  <span className="hidden sm:inline">
                    {hasData ? 'Connected to DB' : probed ? 'DB Offline' : 'Connecting…'}
                  </span>
                </div>
                {/* Live status ping */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
              style={{ maxHeight: '420px' }}
            >
              {msgs.length === 0 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <Sparkles className="size-8 text-emerald-500 mb-2" />
                  <h4 className="font-medium text-sm mb-1">Ask ChemStab AI</h4>
                  <p className="text-[11px] text-muted-foreground mb-3 max-w-[300px]">
                    Connected to your molecule database. Ask about specific compounds, studies, or stability guidelines.
                  </p>
                  <div className="flex flex-col gap-2 w-full max-w-[340px]">
                    {QPROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="group text-left px-3 py-2 rounded-lg border hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs transition-colors flex items-start gap-2"
                      >
                        <MessageCircle className="size-3 text-emerald-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="leading-snug">{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) => (
                <motion.div
                  key={m.ts + '-' + i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-br-sm shadow-sm shadow-emerald-500/20'
                        : 'bg-card border rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {m.role === 'assistant' && (
                      <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-emerald-500/15">
                        <Brain className="size-3 text-emerald-500" />
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          ChemStab AI
                        </span>
                      </div>
                    )}
                    {m.role === 'assistant' ? (
                      <div className="text-[13px] text-foreground">
                        <MarkdownView text={m.content} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                    )}
                  </div>

                  {/* Suggested follow-ups (assistant only) */}
                  {m.role === 'assistant' && m.followUps && m.followUps.length > 0 && (
                    <div className="mt-2 max-w-[88%] w-full space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-1">
                        <Lightbulb className="size-3 text-amber-500" />
                        <span>Suggested follow-ups</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {m.followUps.map((fu, j) => (
                          <button
                            key={fu + j}
                            onClick={() => send(fu)}
                            className="group text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-400/40 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-foreground/80 hover:text-foreground transition-colors flex items-center justify-between"
                          >
                            <span>{fu}</span>
                            <ChevronRight className="size-3 text-emerald-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {ld && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex items-center gap-2 bg-card border rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-duration:0.9s] [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-duration:0.9s] [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-duration:0.9s]" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">Searching database…</span>
                  </div>
                </div>
              )}

              {err && (
                <div className="flex flex-col items-center gap-2 py-3">
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <AlertCircle className="size-3.5" />
                    {err}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const last = msgs.filter((m) => m.role === 'user').pop()
                      if (last) {
                        setMsgs((p) => p.slice(0, -1))
                        setErr(null)
                        send(last.content)
                      }
                    }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Retry
                  </Button>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="border-t px-3 py-3 bg-card/50">
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  placeholder="Ask about stability, molecules, or studies…"
                  disabled={ld}
                  className="h-9 text-sm"
                />
                <Button
                  onClick={() => send(input)}
                  disabled={!input.trim() || ld}
                  size="icon"
                  className="h-9 w-9 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0"
                  aria-label="Send message"
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
              {msgs.length > 0 && (
                <button
                  onClick={() => {
                    setMsgs([])
                    setErr(null)
                  }}
                  className="mt-2 text-[10px] text-muted-foreground hover:text-foreground w-full text-center transition-colors"
                >
                  Clear conversation
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
