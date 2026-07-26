import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// ── ChemStab AI Chat Endpoint ──────────────────────────────────────────────
// Uses z-ai-web-dev-sdk for LLM-powered chat completions

const SYSTEM_PROMPT = 'You are ChemStab AI, an expert assistant for chemical stability assessment. You help users understand degradation pathways, QSPR predictions, ICH guidelines, and pharmaceutical stability testing. Provide concise, scientifically accurate answers. When discussing chemical compounds, use proper nomenclature and reference relevant ICH guidelines (Q1A, Q1B, Q1C, Q1D, Q1E, Q1F) where applicable. Keep responses focused and practical.';

// Reuse ZAI instance across requests for better performance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

interface ChatRequestBody {
  message: string;
  context?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const zai = await getZAI();

    // Build messages array
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      {
        role: 'assistant',
        content: SYSTEM_PROMPT,
      },
    ];

    // Add optional context if provided
    if (body.context && body.context.trim().length > 0) {
      messages.push({
        role: 'assistant',
        content: `Context: ${body.context}`,
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: body.message.trim(),
    });

    // Get completion from LLM
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response || response.trim().length === 0) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({ response }, { status: 200 });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
