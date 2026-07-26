import { NextRequest, NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────
interface SubstanceInput {
  name: string;
  concentration: number;
  unit: string;
}

interface ConditionsInput {
  ph: number;
  temperature: number;
  dissolvedOxygen: number;
  lightExposure: string;
}

interface AnalysisRequestBody {
  substances: SubstanceInput[];
  conditions: ConditionsInput;
}

interface RiskBreakdownItem {
  factor: string;
  score: number;
  description: string;
}

interface KineticsPrediction {
  estimatedShelfLifeMonths: number;
  q10: number;
  activationEnergyKjPerMol: number;
  rateConstant: number;
  kineticOrder: number;
}

interface Recommendation {
  priority: string;
  action: string;
  detail: string;
}

interface AnalysisResult {
  overallScore: number;
  riskLevel: string;
  riskBreakdown: RiskBreakdownItem[];
  kineticsPredictions: KineticsPrediction[];
  recommendations: Recommendation[];
  summary: string;
  analyzedAt: string;
}

// ── POST: Run simulated stability analysis ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequestBody = await request.json();

    if (!body.substances || body.substances.length === 0) {
      return NextResponse.json(
        { error: 'At least one substance is required' },
        { status: 400 }
      );
    }
    if (!body.conditions) {
      return NextResponse.json(
        { error: 'Conditions are required' },
        { status: 400 }
      );
    }

    const { ph, temperature, dissolvedOxygen, lightExposure } = body.conditions;

    // ── Compute simulated scores based on input parameters ──────────
    // Temperature effect: higher temp → more degradation
    const tempFactor = Math.max(0, Math.min(100,
      100 - (temperature - 25) * 2.5
    ));

    // pH stability: best around 7, deviate → less stable
    const phDeviation = Math.abs(ph - 7);
    const phFactor = Math.max(0, Math.min(100,
      100 - phDeviation * 15
    ));

    // Dissolved oxygen: higher → more oxidation risk
    const oxygenFactor = Math.max(0, Math.min(100,
      100 - dissolvedOxygen * 3
    ));

    // Light exposure: exposed → photolysis risk
    const lightMap: Record<string, number> = {
      protected: 95,
      indoor: 70,
      outdoor: 40,
      uv: 15,
    };
    const lightFactor = lightMap[lightExposure] ?? 60;

    // Concentration-weighted substance stability (simulated heuristic)
    const substanceConcentrationEffect = body.substances.reduce((sum, s) => {
      // Higher concentration → slightly more stable (dilution effect)
      return sum + Math.min(100, s.concentration * 0.5 + 50);
    }, 0) / body.substances.length;

    // ── Overall score ──────────────────────────────────────────────
    const overallScore = Math.round(
      (tempFactor * 0.25 +
       phFactor * 0.30 +
       oxygenFactor * 0.15 +
       lightFactor * 0.15 +
       substanceConcentrationEffect * 0.15)
    );

    // ── Risk level ─────────────────────────────────────────────────
    let riskLevel: string;
    if (overallScore >= 80) riskLevel = 'low';
    else if (overallScore >= 60) riskLevel = 'moderate';
    else if (overallScore >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    // ── Risk breakdown ─────────────────────────────────────────────
    const riskBreakdown: RiskBreakdownItem[] = [
      {
        factor: 'Hydrolysis',
        score: Math.round(phFactor),
        description: ph < 5
          ? 'Acidic conditions accelerate hydrolytic degradation'
          : ph > 9
            ? 'Alkaline conditions promote base-catalyzed hydrolysis'
            : 'Near-neutral pH minimizes hydrolytic risk',
      },
      {
        factor: 'Oxidation',
        score: Math.round(oxygenFactor),
        description: dissolvedOxygen > 5
          ? 'High dissolved oxygen significantly increases oxidative pathways'
          : dissolvedOxygen > 2
            ? 'Moderate oxygen levels present measurable oxidation risk'
            : 'Low oxygen environment limits oxidative degradation',
      },
      {
        factor: 'Photolysis',
        score: Math.round(lightFactor),
        description: lightExposure === 'uv'
          ? 'UV exposure causes severe photolytic degradation'
          : lightExposure === 'outdoor'
            ? 'Outdoor light conditions present significant photolysis risk'
            : 'Protected storage conditions minimize photolytic risk',
      },
      {
        factor: 'Thermal',
        score: Math.round(tempFactor),
        description: temperature > 40
          ? 'Elevated temperature significantly accelerates thermal degradation'
          : temperature > 30
            ? 'Moderately elevated temperature increases degradation kinetics'
            : 'Ambient temperature conditions are favorable for stability',
      },
    ];

    // ── Kinetics predictions ──────────────────────────────────────
    const q10 = Math.max(1.5, 2 + (temperature - 25) * 0.02);
    const activationEnergy = 50 + (100 - overallScore) * 0.8;
    const rateConstant = 0.001 * Math.exp((temperature - 25) * 0.03);
    // Base shelf life proportional to stability score, reduced by temperature
    const tempAdjustment = 1 + (temperature - 25) * 0.02;
    const baseShelfLife = 36 * (overallScore / 100) / tempAdjustment;

    const kineticsPredictions: KineticsPrediction[] = body.substances.map((_s, i) => ({
      estimatedShelfLifeMonths: Math.max(3, Math.round(
        baseShelfLife * (0.85 + i * 0.1)
      )),
      q10: Math.round(q10 * 100) / 100,
      activationEnergyKjPerMol: Math.round(activationEnergy * 100) / 100,
      rateConstant: Math.round(rateConstant * 10000) / 10000,
      kineticOrder: 1,
    }));

    // ── Recommendations ────────────────────────────────────────────
    const recommendations: Recommendation[] = [];

    if (phFactor < 70) {
      recommendations.push({
        priority: 'high',
        action: 'pH Adjustment',
        detail: `Consider buffering the formulation to pH 6–8. Current pH (${ph}) deviates significantly from optimal range.`,
      });
    }
    if (tempFactor < 70) {
      recommendations.push({
        priority: 'high',
        action: 'Temperature Control',
        detail: `Store at controlled room temperature (15–25°C). Current temperature (${temperature}°C) accelerates degradation.`,
      });
    }
    if (oxygenFactor < 70) {
      recommendations.push({
        priority: 'medium',
        action: 'Oxygen Scavenging',
        detail: `Implement nitrogen headspace or oxygen scavenger packaging. Current dissolved O₂ (${dissolvedOxygen} mg/L) poses oxidation risk.`,
      });
    }
    if (lightFactor < 70) {
      recommendations.push({
        priority: 'medium',
        action: 'Light Protection',
        detail: 'Use amber glass containers or opaque packaging. Consider adding UV absorbers to the formulation.',
      });
    }
    if (overallScore >= 80) {
      recommendations.push({
        priority: 'low',
        action: 'Standard Monitoring',
        detail: 'Formulation shows good stability under current conditions. Continue routine monitoring per ICH Q1A guidelines.',
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        action: 'Continue Monitoring',
        detail: 'Conditions are generally favorable. Maintain current storage and handling protocols.',
      });
    }

    // ── Summary ────────────────────────────────────────────────────
    const summary = `Analysis of ${body.substances.length} substance(s) under pH ${ph}, ${temperature}°C, ${dissolvedOxygen} mg/L O₂, ${lightExposure} light conditions yields an overall stability score of ${overallScore}/100 (${riskLevel} risk). ${recommendations.length} recommendation(s) generated.`;

    const result: AnalysisResult = {
      overallScore,
      riskLevel,
      riskBreakdown,
      kineticsPredictions,
      recommendations,
      summary,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    console.error('POST /api/analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
