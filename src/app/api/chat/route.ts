import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

// ── ChemStab AI Chat Endpoint (RAG-style) ──────────────────────────────────
// Uses z-ai-web-dev-sdk for LLM-powered chat completions.
// Before calling the LLM, we fetch molecule + study data from the database
// and inject it as context (RAG-style retrieval) into the system prompt.

const SYSTEM_PROMPT_BASE = `You are ChemStab AI, a pharmaceutical stability assistant. You have access to the following molecule database and recent studies. Answer questions about chemical stability, degradation pathways, and regulatory guidelines (ICH Q1A). When users ask about specific molecules, reference the data provided.

Guidelines:
- Provide concise, scientifically accurate answers.
- Use proper chemical nomenclature and reference relevant ICH guidelines (Q1A, Q1B, Q1C, Q1D, Q1E, Q1F) where applicable.
- When the user asks about a molecule that exists in the database, cite its stability score, risk level, and formula.
- When asked to compare molecules, present the comparison in a structured, easy-to-read format.
- When asked about studies, reference the study codes and statuses available.
- Use Markdown formatting (bold **text**, bullet points, and \`inline code\` or code blocks where helpful).
- If the database context does not contain relevant data for a question, answer from general pharmaceutical knowledge and note that the data is not in the local database.`;

// Reuse ZAI instance across requests for better performance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ── Database Context Builders ─────────────────────────────────────────────

/**
 * Fetch molecules and recent studies from the database and assemble a
 * context string that will be appended to the system prompt (RAG-style).
 * Returns an object containing the context string and a flag indicating
 * whether any database data was found.
 */
async function buildDatabaseContext(): Promise<{ context: string; hasData: boolean }> {
  try {
    // Fetch molecules (limit to keep prompt size reasonable)
    const molecules = await db.molecule.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        casNumber: true,
        formula: true,
        molarMass: true,
        logP: true,
        predictedStabilityScore: true,
        predictionConfidence: true,
        riskLevel: true,
        hazardClass: true,
        description: true,
      },
    });

    // Fetch recent stability studies
    const studies = await db.stabilityStudy.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        studyCode: true,
        substanceName: true,
        studyType: true,
        status: true,
        temperatureC: true,
        humidityPercent: true,
        durationMonths: true,
        predictedShelfLifeMonths: true,
        ph: true,
        lightExposure: true,
      },
    });

    if (molecules.length === 0 && studies.length === 0) {
      return { context: '', hasData: false };
    }

    const sections: string[] = [];

    if (molecules.length > 0) {
      const molLines = molecules.map((m) => {
        const parts: string[] = [`- **${m.name}**`];
        if (m.formula) parts.push(`formula: ${m.formula}`);
        if (m.casNumber) parts.push(`CAS: ${m.casNumber}`);
        if (m.molarMass != null) parts.push(`MW: ${m.molarMass.toFixed(2)}`);
        if (m.logP != null) parts.push(`logP: ${m.logP.toFixed(2)}`);
        if (m.predictedStabilityScore != null) {
          parts.push(`stability: ${m.predictedStabilityScore.toFixed(1)}/100`);
        }
        if (m.predictionConfidence != null) {
          parts.push(`confidence: ${(m.predictionConfidence * 100).toFixed(0)}%`);
        }
        if (m.riskLevel) parts.push(`risk: ${m.riskLevel}`);
        if (m.hazardClass) parts.push(`hazard: ${m.hazardClass}`);
        if (m.description) {
          const desc = m.description.length > 180 ? m.description.slice(0, 180) + '…' : m.description;
          parts.push(`desc: "${desc}"`);
        }
        return parts.join(' | ');
      });
      sections.push(
        `### Molecule Database (${molecules.length} molecules)\n` + molLines.join('\n')
      );
    }

    if (studies.length > 0) {
      const studyLines = studies.map((s) => {
        const parts: string[] = [`- **${s.studyCode}**`];
        if (s.substanceName) parts.push(`substance: ${s.substanceName}`);
        if (s.studyType) parts.push(`type: ${s.studyType}`);
        if (s.status) parts.push(`status: ${s.status}`);
        if (s.temperatureC != null) parts.push(`T: ${s.temperatureC}°C`);
        if (s.humidityPercent != null) parts.push(`RH: ${s.humidityPercent}%`);
        if (s.durationMonths != null) parts.push(`duration: ${s.durationMonths}mo`);
        if (s.predictedShelfLifeMonths != null) {
          parts.push(`shelf-life: ${s.predictedShelfLifeMonths}mo`);
        }
        if (s.ph != null) parts.push(`pH: ${s.ph}`);
        if (s.lightExposure) parts.push(`light: ${s.lightExposure}`);
        return parts.join(' | ');
      });
      sections.push(
        `### Recent Stability Studies (${studies.length} studies)\n` + studyLines.join('\n')
      );
    }

    const context = `\n\n## Database Context (Live)\n\n${sections.join('\n\n')}`;
    return { context, hasData: true };
  } catch (error) {
    console.error('buildDatabaseContext error:', error);
    return { context: '', hasData: false };
  }
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

    // Build RAG-style database context (molecules + studies)
    const { context: dbContext, hasData } = await buildDatabaseContext();

    // Compose the final system prompt with database context
    const systemPrompt = dbContext
      ? `${SYSTEM_PROMPT_BASE}\n\n${dbContext}`
      : `${SYSTEM_PROMPT_BASE}\n\nNote: The molecule database is currently empty or unreachable. Answer from general pharmaceutical knowledge when possible.`;

    const zai = await getZAI();

    // Build messages array (system → optional client context → user)
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: systemPrompt },
    ];

    if (body.context && body.context.trim().length > 0) {
      messages.push({ role: 'assistant', content: `Additional context: ${body.context}` });
    }

    messages.push({ role: 'user', content: body.message.trim() });

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

    return NextResponse.json({ response, hasData }, { status: 200 });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
