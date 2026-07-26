import { NextRequest, NextResponse } from 'next/server';

// ── Constants ──────────────────────────────────────────────────────────
const R = 8.314; // Gas constant, J/(mol·K)
const T1 = 298.15; // Reference temperature (25°C) in Kelvin
const SHELF_LIFE_THRESHOLD = 0.10; // 10% degradation

// ── Types ──────────────────────────────────────────────────────────────
interface StabilityRequestBody {
  activationEnergy: number; // kJ/mol
  rateConstant25C: number; // 1/months
  temperatureC: number; // °C
  durationMonths: number; // months
  kineticOrder: 0 | 1 | 2;
}

interface CurvePoint {
  month: number;
  degradation: number;
  potency: number;
}

interface StabilityResult {
  rateConstantAtTarget: number; // 1/months
  degradationPercent: number; // %
  remainingPotencyPercent: number; // %
  shelfLifeMonths: number; // months (time to 10% degradation); -1 if infinite
  kineticOrder: 0 | 1 | 2;
  activationEnergy: number; // kJ/mol
  rateConstant25C: number; // 1/months
  temperatureC: number; // °C
  temperatureK: number; // K
  q10: number; // ratio of rate constants at T+10 and T
  arrheniusFactor: number; // k2/k1
  curve: CurvePoint[];
  input: StabilityRequestBody;
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Compute the degradation fraction given kinetic order.
 *  - Zero-order:   D = k * t  (capped at 1)
 *  - First-order:  D = 1 - exp(-k * t)
 *  - Second-order: D = k * t / (1 + k * t)
 */
function degradationFraction(k: number, t: number, order: 0 | 1 | 2): number {
  if (k <= 0 || t <= 0) return 0;
  switch (order) {
    case 0:
      return Math.min(1, k * t);
    case 1:
      return 1 - Math.exp(-k * t);
    case 2:
      return (k * t) / (1 + k * t);
    default:
      return 0;
  }
}

/**
 * Compute time (months) to reach a given degradation threshold.
 */
function timeToThreshold(
  k: number,
  threshold: number,
  order: 0 | 1 | 2
): number {
  if (k <= 0 || threshold <= 0 || threshold >= 1) return Infinity;
  switch (order) {
    case 0:
      // D = k*t → t = D/k
      return threshold / k;
    case 1:
      // D = 1 - exp(-k*t) → t = -ln(1-D)/k
      return -Math.log(1 - threshold) / k;
    case 2:
      // D = k*t/(1+k*t) → t = D / (k * (1-D))
      return threshold / (k * (1 - threshold));
    default:
      return Infinity;
  }
}

// ── POST: Run Arrhenius-based stability calculation ──────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StabilityRequestBody;

    // ── Input validation ──────────────────────────────────────────
    const errors: string[] = [];

    const {
      activationEnergy,
      rateConstant25C,
      temperatureC,
      durationMonths,
      kineticOrder,
    } = body;

    if (
      typeof activationEnergy !== 'number' ||
      Number.isNaN(activationEnergy) ||
      !Number.isFinite(activationEnergy) ||
      activationEnergy <= 0 ||
      activationEnergy > 1000
    ) {
      errors.push('activationEnergy must be a positive number (kJ/mol, ≤ 1000)');
    }
    if (
      typeof rateConstant25C !== 'number' ||
      Number.isNaN(rateConstant25C) ||
      !Number.isFinite(rateConstant25C) ||
      rateConstant25C <= 0 ||
      rateConstant25C > 10
    ) {
      errors.push('rateConstant25C must be a positive number (1/months, ≤ 10)');
    }
    if (
      typeof temperatureC !== 'number' ||
      Number.isNaN(temperatureC) ||
      !Number.isFinite(temperatureC) ||
      temperatureC < -50 ||
      temperatureC > 200
    ) {
      errors.push('temperatureC must be a number in [-50, 200] °C');
    }
    if (
      typeof durationMonths !== 'number' ||
      Number.isNaN(durationMonths) ||
      !Number.isFinite(durationMonths) ||
      durationMonths <= 0 ||
      durationMonths > 600
    ) {
      errors.push('durationMonths must be a positive number (≤ 600 months)');
    }
    if (![0, 1, 2].includes(kineticOrder)) {
      errors.push('kineticOrder must be 0, 1, or 2');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // ── Arrhenius equation ────────────────────────────────────────
    // k2 = k1 * exp((Ea/R) * (1/T1 - 1/T2))
    // Ea is given in kJ/mol; convert to J/mol for unit consistency with R.
    const Ea_J_per_mol = activationEnergy * 1000;
    const T2 = temperatureC + 273.15;

    const arrheniusExponent = (Ea_J_per_mol / R) * (1 / T1 - 1 / T2);
    const arrheniusFactor = Math.exp(arrheniusExponent);
    const rateConstantAtTarget = rateConstant25C * arrheniusFactor;

    // ── Degradation at requested duration ─────────────────────────
    const degradationFrac = degradationFraction(
      rateConstantAtTarget,
      durationMonths,
      kineticOrder
    );
    const degradationPercent = degradationFrac * 100;
    const remainingPotencyPercent = Math.max(0, 100 - degradationPercent);

    // ── Shelf life (time to 10% degradation) ──────────────────────
    const shelfLifeMonths = timeToThreshold(
      rateConstantAtTarget,
      SHELF_LIFE_THRESHOLD,
      kineticOrder
    );

    // ── Q10 (temperature coefficient) ─────────────────────────────
    // Q10 = k(T+10) / k(T) computed via Arrhenius for the same Ea.
    const T_plus10 = T2 + 10;
    const q10Exponent =
      (Ea_J_per_mol / R) * (1 / T2 - 1 / T_plus10);
    const q10 = Math.exp(q10Exponent);

    // ── Degradation curve (sampled over the duration) ────────────
    // Generate up to 50 points, capped at the requested duration plus
    // a small extension so the user can see the projected trend.
    const curvePoints = 50;
    const shelfFinite = isFinite(shelfLifeMonths) ? shelfLifeMonths : durationMonths * 2;
    const curveHorizon = Math.max(
      durationMonths,
      Math.min(shelfFinite * 2, durationMonths * 3)
    );
    const curve: CurvePoint[] = [];
    for (let i = 0; i <= curvePoints; i++) {
      const month = (curveHorizon * i) / curvePoints;
      const dFrac = degradationFraction(
        rateConstantAtTarget,
        month,
        kineticOrder
      );
      curve.push({
        month: Math.round(month * 100) / 100,
        degradation: Math.round(dFrac * 10000) / 100,
        potency: Math.round((1 - dFrac) * 10000) / 100,
      });
    }

    const result: StabilityResult = {
      rateConstantAtTarget: Math.round(rateConstantAtTarget * 1e8) / 1e8,
      degradationPercent: Math.round(degradationPercent * 1000) / 1000,
      remainingPotencyPercent: Math.round(remainingPotencyPercent * 1000) / 1000,
      shelfLifeMonths: isFinite(shelfLifeMonths)
        ? Math.round(shelfLifeMonths * 100) / 100
        : -1, // -1 indicates "effectively infinite"
      kineticOrder,
      activationEnergy,
      rateConstant25C,
      temperatureC,
      temperatureK: Math.round(T2 * 100) / 100,
      q10: Math.round(q10 * 1000) / 1000,
      arrheniusFactor: Math.round(arrheniusFactor * 1000) / 1000,
      curve,
      input: body,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    console.error('POST /api/stability-calculator error:', error);
    return NextResponse.json(
      { error: 'Failed to compute stability prediction' },
      { status: 500 }
    );
  }
}

// ── GET: Return documentation / reference for the calculator ─────────
export async function GET() {
  return NextResponse.json({
    name: 'Stability Prediction Calculator',
    description:
      'Predicts shelf life and degradation based on the Arrhenius equation and reaction kinetics.',
    formula: {
      arrhenius: 'k₂ = k₁ · exp((Eₐ/R) · (1/T₁ − 1/T₂))',
      constants: {
        R: '8.314 J/(mol·K)',
        T1: '298.15 K (25°C reference)',
      },
      kinetics: {
        zeroOrder: 'D = k·t',
        firstOrder: 'D = 1 − exp(−k·t)',
        secondOrder: 'D = k·t / (1 + k·t)',
      },
      shelfLife: 'Time to reach 10% degradation',
    },
    units: {
      activationEnergy: 'kJ/mol',
      rateConstant25C: '1/months',
      temperatureC: '°C',
      durationMonths: 'months',
    },
    defaults: {
      activationEnergy: 100,
      rateConstant25C: 0.01,
      temperatureC: 25,
      durationMonths: 12,
      kineticOrder: 1,
    },
  });
}
