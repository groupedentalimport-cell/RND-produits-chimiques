'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Sparkles, MessageCircle, AlertCircle, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const QPROMPTS = ['Explain hydrolysis degradation', 'What is ICH Q1A?', 'How does Q10 affect shelf life?', 'Compare stability of Aspirin vs Ibuprofen']
interface CMsg { role: 'user' | 'assistant'; content: string; ts: number }

export function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<CMsg[]>([])
  const [input, setInput] = useState('')
  const [ld, setLd] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const send = useCallback(async (t: string) => {
    if (!t.trim() || ld) return
    setMsgs(p => [...p, { role: 'user', content: t.trim(), ts: Date.now() }])
    setInput(''); setLd(true); setErr(null)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t.trim() }) })
      if (!r.ok) { const errData = await r.json().catch(() => ({ error: 'Request failed' })); throw new Error(errData.error || `HTTP ${r.status}`) }
      const data = await r.json()
      setMsgs(p => [...p, { role: 'assistant', content: data.response, ts: Date.now() }])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setLd(false) }
  }, [ld])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  return (
    <>
      <motion.button onClick={() => setOpen(!open)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center" aria-label="AI Assistant">
        {open ? <X className="size-5" /> : <Brain className="size-5" />}
        {!open && <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-gradient-to-br from-emerald-500 to-teal-600" />}
      </motion.button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] rounded-2xl border bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-500/10">
            <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white"><Brain className="size-3.5" /></div><div><h3 className="font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">ChemStab AI</h3><p className="text-[10px] text-muted-foreground">Stability expert</p></div></div>
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: '400px' }}>
            {msgs.length === 0 && <div className="flex flex-col items-center py-8 text-center"><Sparkles className="size-8 text-emerald-500 mb-2" /><h4 className="font-medium text-sm mb-3">Ask ChemStab AI</h4><div className="flex flex-col gap-2 w-full max-w-[320px]">{QPROMPTS.map(p => <button key={p} onClick={() => send(p)} className="text-left px-3 py-2 rounded-lg border hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs transition-colors"><MessageCircle className="size-3 text-emerald-500 mr-2 inline" />{p}</button>)}</div></div>}
            {msgs.map((m, i) => <motion.div key={m.ts + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' : 'bg-card border'}`}>
                {m.role === 'assistant' && <div className="flex items-center gap-1 mb-1"><Brain className="size-3 text-emerald-500" /><span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">AI</span></div>}
                <p className="whitespace-pre-wrap">{m.content}</p></div></motion.div>)}
            {ld && <div className="flex items-center gap-1 py-3"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" /><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" /><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" /><span className="text-xs text-muted-foreground ml-2">Thinking...</span></div>}
            {err && <div className="flex flex-col items-center gap-2 py-3"><div className="flex items-center gap-2 text-destructive text-xs"><AlertCircle className="size-3.5" />{err}</div><Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { const l = msgs.filter(m => m.role === 'user').pop(); if (l) { setMsgs(p => p.slice(0, -1)); setErr(null); send(l.content) } }}><RefreshCw className="size-3 mr-1" />Retry</Button></div>}
            <div ref={endRef} />
          </div>
          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-2"><Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }} placeholder="Ask about stability..." disabled={ld} className="h-9 text-sm" /><Button onClick={() => send(input)} disabled={!input.trim() || ld} size="icon" className="h-9 w-9 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0"><Send className="size-3.5" /></Button></div>
            {msgs.length > 0 && <button onClick={() => { setMsgs([]); setErr(null) }} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground w-full text-center">Clear conversation</button>}
          </div>
        </motion.div>
      )}</AnimatePresence>
    </>
  )
}
