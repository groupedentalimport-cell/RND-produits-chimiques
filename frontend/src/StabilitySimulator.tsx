/**
 * StabilitySimulator.tsx — Interactive Stability Study Simulator
 * ICH Q1A-Q1F compliant with time-dependent molecular degradation visualization.
 *
 * Features:
 *   - Single-condition simulation with real-time chart
 *   - Full ICH protocol (multi-condition) generation
 *   - Climate zone selector
 *   - Arrhenius extrapolation from accelerated data
 *   - Monte Carlo uncertainty visualization
 *   - Molecular risk assessment (SMILES input)
 *   - Study management (create, add timepoints, approve)
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────

interface TimePoint {
  time_days: number;
  time_months: number;
  concentration: number;
  percent_remaining: number;
  degradation_percent: number;
  is_oos: boolean;
  is_oot: boolean;
}

interface SimulationResult {
  condition_code: string;
  condition_description: string;
  substance_name: string;
  initial_concentration: number;
  concentration_unit: string;
  temperature_c: number;
  humidity_percent: number | null;
  kinetic_order: number;
  activation_energy: number;
  rate_constant: number;
  time_points: TimePoint[];
  shelf_life_days: number | null;
  shelf_life_months: number | null;
  t90_days: number | null;
  t95_days: number | null;
  t99_days: number | null;
  regression: {
    slope: number | null;
    intercept: number | null;
    r_squared: number | null;
    ci_lower_days: number | null;
    ci_upper_days: number | null;
  };
  simulation_type: string;
  ich_reference: string;
  computed_at: string;
}

interface ProtocolResult {
  climate_zone: string;
  conditions_simulated: string[];
  simulations: Record<string, SimulationResult>;
  summary: {
    conditions: number;
    shelf_lives: Record<string, { shelf_life_days: number | null; shelf_life_months: number | null }>;
    critical_findings: string[];
  };
}

interface MonteCarloResult {
  n_simulations: number;
  mean_shelf_life_days: number;
  std_shelf_life_days: number;
  mean_shelf_life_months: number;
  confidence_level: number;
  ci_lower_days: number;
  ci_upper_days: number;
  ci_lower_months: number;
  ci_upper_months: number;
  min_days: number;
  max_days: number;
  histogram: { bins: number[]; counts: number[] };
}

interface MolecularRisk {
  overall_stability_score: number;
  functional_groups: Array<{
    name: string;
    count: number;
    risk: string;
    weight: number;
    description: string;
  }>;
  pathway_risks: Record<string, number>;
  recommendations: string[];
}

type Tab = "simulate" | "protocol" | "extrapolate" | "monte-carlo" | "molecular-risk" | "studies";

const API_BASE = "/api/v1/stability";

// ── Color Palette ─────────────────────────────────────────────────────

const COLORS = {
  primary: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  pink: "#EC4899",
  indigo: "#6366F1",
};

const CONDITION_COLORS: Record<string, string> = {
  "long_term_I": COLORS.success,
  "long_term_II": COLORS.primary,
  "long_term_III": COLORS.warning,
  "long_term_IVa": COLORS.purple,
  "long_term_IVb": COLORS.danger,
  accelerated: COLORS.danger,
  intermediate: COLORS.warning,
  stress_thermal: COLORS.pink,
  stress_humidity: COLORS.cyan,
  stress_oxidative: COLORS.indigo,
  photostability: COLORS.purple,
};

// ── Main Component ────────────────────────────────────────────────────

const StabilitySimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("simulate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [protocolResult, setProtocolResult] = useState<ProtocolResult | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [riskResult, setRiskResult] = useState<MolecularRisk | null>(null);
  const [extrapResult, setExtrapResult] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    substance_name: "Acetylsalicylic Acid",
    initial_concentration: 100,
    concentration_unit: "mg/mL",
    temperature_c: 25,
    humidity_percent: 60,
    activation_energy: 75000,
    pre_exponential_factor: 1e10,
    kinetic_order: 1,
    duration_months: 36,
    spec_lower: 90,
    climate_zone: "II",
    include_stress: true,
    include_photostability: false,
  });

  const [extrapForm, setExtrapForm] = useState({
    accelerated_rate_constant: 0.005,
    accelerated_temperature_c: 40,
    storage_temperature_c: 25,
    activation_energy: 75000,
    kinetic_order: 1,
  });

  const [mcForm, setMcForm] = useState({
    mean_activation_energy: 75000,
    std_activation_energy: 7500,
    mean_pre_exponential: 1e10,
    std_pre_exponential: 1e9,
    temperature_c: 25,
    kinetic_order: 1,
    n_simulations: 5000,
    confidence_level: 0.95,
  });

  const [smilesInput, setSmilesInput] = useState("CC(=O)Oc1ccccc1C(=O)O");

  // ── API calls ─────────────────────────────────────────────────────

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSimResult(data.simulation);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const runProtocol = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/protocol`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substance_name: form.substance_name,
          initial_concentration: form.initial_concentration,
          concentration_unit: form.concentration_unit,
          activation_energy: form.activation_energy,
          pre_exponential_factor: form.pre_exponential_factor,
          kinetic_order: form.kinetic_order,
          climate_zone: form.climate_zone,
          spec_lower: form.spec_lower,
          include_stress: form.include_stress,
          include_photostability: form.include_photostability,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProtocolResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const runExtrapolation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/extrapolate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extrapForm),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExtrapResult(data.extrapolation);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [extrapForm]);

  const runMonteCarlo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/monte-carlo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mcForm),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMcResult(data.monte_carlo);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mcForm]);

  const runMolecularRisk = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/molecular-risk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: smilesInput }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRiskResult(data.risk_assessment);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [smilesInput]);

  // ── Chart data ────────────────────────────────────────────────────

  const simChartData = useMemo(() => {
    if (!simResult) return [];
    return simResult.time_points.map((tp) => ({
      time: tp.time_months,
      remaining: tp.percent_remaining,
      degradation: tp.degradation_percent,
      oos: tp.is_oos,
    }));
  }, [simResult]);

  const protocolChartData = useMemo(() => {
    if (!protocolResult) return [];
    // Merge all time series into one chart-friendly format
    const allTimes = new Set<number>();
    Object.values(protocolResult.simulations).forEach((sim) => {
      sim.time_points.forEach((tp) => allTimes.add(tp.time_months));
    });
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    return sortedTimes.map((t) => {
      const point: any = { time: t };
      Object.entries(protocolResult.simulations).forEach(([code, sim]) => {
        const tp = sim.time_points.find((p) => p.time_months === t);
        point[code] = tp ? tp.percent_remaining : null;
      });
      return point;
    });
  }, [protocolResult]);

  const mcHistogramData = useMemo(() => {
    if (!mcResult?.histogram) return [];
    return mcResult.histogram.bins.slice(0, -1).map((bin, i) => ({
      bin: Math.round(bin),
      count: mcResult.histogram.counts[i],
    }));
  }, [mcResult]);

  // ── Tabs ──────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "simulate", label: "Simulation", icon: "🧪" },
    { key: "protocol", label: "Protocole ICH", icon: "📋" },
    { key: "extrapolate", label: "Extrapolation", icon: "📈" },
    { key: "monte-carlo", label: "Monte Carlo", icon: "🎲" },
    { key: "molecular-risk", label: "Risque Moléculaire", icon: "⚗️" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          ⚗️ Simulateur de Stabilité Moléculaire
        </h1>
        <p className="text-gray-600 mt-2">
          Études de stabilité conformes ICH Q1A-Q1F — Simulation cinétique dans le facteur temps
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "simulate" && (
          <SimulationTab
            form={form}
            setForm={setForm}
            result={simResult}
            chartData={simChartData}
            loading={loading}
            onRun={runSimulation}
          />
        )}
        {activeTab === "protocol" && (
          <ProtocolTab
            form={form}
            setForm={setForm}
            result={protocolResult}
            chartData={protocolChartData}
            loading={loading}
            onRun={runProtocol}
          />
        )}
        {activeTab === "extrapolate" && (
          <ExtrapolationTab
            form={extrapForm}
            setForm={setExtrapForm}
            result={extrapResult}
            loading={loading}
            onRun={runExtrapolation}
          />
        )}
        {activeTab === "monte-carlo" && (
          <MonteCarloTab
            form={mcForm}
            setForm={setMcForm}
            result={mcResult}
            histogramData={mcHistogramData}
            loading={loading}
            onRun={runMonteCarlo}
          />
        )}
        {activeTab === "molecular-risk" && (
          <MolecularRiskTab
            smiles={smilesInput}
            setSmiles={setSmilesInput}
            result={riskResult}
            loading={loading}
            onRun={runMolecularRisk}
          />
        )}
      </div>
    </div>
  );
};

// ── Simulation Tab ────────────────────────────────────────────────────

const SimulationTab: React.FC<{
  form: any;
  setForm: (f: any) => void;
  result: SimulationResult | null;
  chartData: any[];
  loading: boolean;
  onRun: () => void;
}> = ({ form, setForm, result, chartData, loading, onRun }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Form */}
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold">Paramètres de Simulation</h2>

      <InputField label="Substance" value={form.substance_name}
        onChange={(v) => setForm({ ...form, substance_name: v })} />
      <InputField label="Concentration initiale" type="number" value={form.initial_concentration}
        onChange={(v) => setForm({ ...form, initial_concentration: +v })} />
      <InputField label="Unité" value={form.concentration_unit}
        onChange={(v) => setForm({ ...form, concentration_unit: v })} />
      <InputField label="Température (°C)" type="number" value={form.temperature_c}
        onChange={(v) => setForm({ ...form, temperature_c: +v })} />
      <InputField label="Humidité (%RH)" type="number" value={form.humidity_percent}
        onChange={(v) => setForm({ ...form, humidity_percent: +v })} />
      <InputField label="Ea (J/mol)" type="number" value={form.activation_energy}
        onChange={(v) => setForm({ ...form, activation_energy: +v })} />
      <InputField label="Facteur A" type="number" value={form.pre_exponential_factor}
        onChange={(v) => setForm({ ...form, pre_exponential_factor: +v })} />

      <SelectField label="Ordre cinétique" value={form.kinetic_order}
        options={[{ v: 0, l: "Zéro" }, { v: 1, l: "Premier" }, { v: 2, l: "Second" }]}
        onChange={(v) => setForm({ ...form, kinetic_order: +v })} />

      <InputField label="Durée (mois)" type="number" value={form.duration_months}
        onChange={(v) => setForm({ ...form, duration_months: +v })} />
      <InputField label="Limite basse spec (%)" type="number" value={form.spec_lower}
        onChange={(v) => setForm({ ...form, spec_lower: +v })} />

      <button
        onClick={onRun}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "⏳ Calcul en cours..." : "🚀 Lancer la Simulation"}
      </button>
    </div>

    {/* Chart + Results */}
    <div className="lg:col-span-2 space-y-6">
      {result && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Shelf Life" value={result.shelf_life_months?.toFixed(1) ?? "—"} unit="mois" color="blue" />
            <KpiCard label="t90" value={result.t90_days?.toFixed(0) ?? "—"} unit="jours" color="green" />
            <KpiCard label="t95" value={result.t95_days?.toFixed(0) ?? "—"} unit="jours" color="amber" />
            <KpiCard label="R²" value={result.regression.r_squared?.toFixed(4) ?? "—"} unit="" color="purple" />
          </div>

          {/* Degradation Curve */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">
              Courbe de Dégradation — {result.condition_description}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: "Temps (mois)", position: "insideBottom", offset: -5 }} />
                <YAxis domain={[0, 105]} label={{ value: "% Restant", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Legend />
                <ReferenceLine y={form.spec_lower} stroke={COLORS.danger} strokeDasharray="5 5"
                  label={{ value: `Spec ${form.spec_lower}%`, position: "right" }} />
                <Line type="monotone" dataKey="remaining" stroke={COLORS.primary}
                  strokeWidth={2} dot={{ r: 4 }} name="% Restant" />
                <Line type="monotone" dataKey="degradation" stroke={COLORS.danger}
                  strokeWidth={2} dot={{ r: 4 }} name="% Dégradation" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Regression Info */}
          {result.regression.slope !== null && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-3">📊 Analyse Statistique (ICH Q1E)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Pente:</span> <span className="font-mono">{result.regression.slope} %/mois</span></div>
                <div><span className="text-gray-500">Ordonnée:</span> <span className="font-mono">{result.regression.intercept}%</span></div>
                <div><span className="text-gray-500">R²:</span> <span className="font-mono">{result.regression.r_squared}</span></div>
                <div><span className="text-gray-500">IC bas:</span> <span className="font-mono">{result.regression.ci_lower_days?.toFixed(1)} j</span></div>
                <div><span className="text-gray-500">IC haut:</span> <span className="font-mono">{result.regression.ci_upper_days?.toFixed(1)} j</span></div>
                <div><span className="text-gray-500">Référence:</span> <span className="font-mono">{result.ich_reference}</span></div>
              </div>
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <p className="text-4xl mb-4">🧪</p>
          <p>Configurez les paramètres et lancez la simulation</p>
        </div>
      )}
    </div>
  </div>
);

// ── Protocol Tab ──────────────────────────────────────────────────────

const ProtocolTab: React.FC<{
  form: any;
  setForm: (f: any) => void;
  result: ProtocolResult | null;
  chartData: any[];
  loading: boolean;
  onRun: () => void;
}> = ({ form, setForm, result, chartData, loading, onRun }) => (
  <div className="space-y-6">
    {/* Controls */}
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-wrap gap-4 items-end">
      <SelectField label="Zone Climatique" value={form.climate_zone}
        options={[
          { v: "I", l: "Zone I — Tempéré" },
          { v: "II", l: "Zone II — Méditerranéen" },
          { v: "III", l: "Zone III — Chaud/Sec" },
          { v: "IVa", l: "Zone IVa — Chaud/Humide" },
          { v: "IVb", l: "Zone IVb — Très Humide" },
        ]}
        onChange={(v) => setForm({ ...form, climate_zone: v })} />

      <InputField label="Ea (J/mol)" type="number" value={form.activation_energy}
        onChange={(v) => setForm({ ...form, activation_energy: +v })} />

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.include_stress}
          onChange={(e) => setForm({ ...form, include_stress: e.target.checked })} />
        <span className="text-sm">Stress tests</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.include_photostability}
          onChange={(e) => setForm({ ...form, include_photostability: e.target.checked })} />
        <span className="text-sm">Photostabilité (Q1B)</span>
      </label>

      <button onClick={onRun} disabled={loading}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? "⏳..." : "🚀 Protocole ICH Complet"}
      </button>
    </div>

    {/* Multi-condition Chart */}
    {result && (
      <>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">
            📋 Protocole ICH — Zone {result.climate_zone} ({result.conditions_simulated.length} conditions)
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" label={{ value: "Temps (mois)", position: "insideBottom", offset: -5 }} />
              <YAxis domain={[0, 105]} label={{ value: "% Restant", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: number) => v ? `${v.toFixed(2)}%` : "—"} />
              <Legend />
              <ReferenceLine y={form.spec_lower} stroke={COLORS.danger} strokeDasharray="5 5" />
              {result.conditions_simulated.map((code) => (
                <Line key={code} type="monotone" dataKey={code}
                  stroke={CONDITION_COLORS[code] || COLORS.primary}
                  strokeWidth={code.includes("long_term") ? 3 : 1.5}
                  dot={{ r: 3 }} name={code} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Shelf Life Comparison */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Comparaison des Shelf Lives</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(result.summary.shelf_lives).map(([code, sl]) => (
              <div key={code} className="border rounded-lg p-3">
                <div className="text-xs text-gray-500">{code}</div>
                <div className="text-xl font-bold" style={{ color: CONDITION_COLORS[code] || COLORS.primary }}>
                  {sl.shelf_life_months?.toFixed(1) ?? "—"}
                </div>
                <div className="text-xs text-gray-400">mois</div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Findings */}
        {result.summary.critical_findings.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-3">⚠️ Constats Critiques</h3>
            <ul className="space-y-2">
              {result.summary.critical_findings.map((f, i) => (
                <li key={i} className="text-red-700">{f}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    )}
  </div>
);

// ── Extrapolation Tab ─────────────────────────────────────────────────

const ExtrapolationTab: React.FC<{
  form: any;
  setForm: (f: any) => void;
  result: any;
  loading: boolean;
  onRun: () => void;
}> = ({ form, setForm, result, loading, onRun }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold">📈 Extrapolation Arrhenius</h2>
      <p className="text-sm text-gray-500">
        Extrapoler la shelf life depuis des conditions accélérées vers les conditions de stockage.
      </p>
      <InputField label="k accéléré (jour⁻¹)" type="number" value={form.accelerated_rate_constant}
        onChange={(v) => setForm({ ...form, accelerated_rate_constant: +v })} />
      <InputField label="T accéléré (°C)" type="number" value={form.accelerated_temperature_c}
        onChange={(v) => setForm({ ...form, accelerated_temperature_c: +v })} />
      <InputField label="T stockage (°C)" type="number" value={form.storage_temperature_c}
        onChange={(v) => setForm({ ...form, storage_temperature_c: +v })} />
      <InputField label="Ea (J/mol)" type="number" value={form.activation_energy}
        onChange={(v) => setForm({ ...form, activation_energy: +v })} />

      <button onClick={onRun} disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? "⏳..." : "📈 Extrapoler"}
      </button>
    </div>

    <div className="space-y-6">
      {result && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Résultats de l'Extrapolation</h3>
            <div className="space-y-3">
              <ResultRow label="Shelf life accéléré" value={`${result.accelerated_shelf_life_days} jours`} />
              <ResultRow label="Shelf life extrapolé" value={`${result.extrapolated_shelf_life_days} jours`} highlight />
              <ResultRow label="Shelf life extrapolé" value={`${result.extrapolated_shelf_life_months} mois`} highlight />
              <ResultRow label="Ea utilisée" value={`${(result.activation_energy / 1000).toFixed(1)} kJ/mol`} />
              <ResultRow label="Q10" value={result.q10_value.toString()} />
              <ResultRow label="Écart T" value={`${result.temperature_gap}°C`} />
              <ResultRow label="Confiance" value={`${(result.confidence_factor * 100).toFixed(0)}%`} />
              <ResultRow label="Méthode" value={result.method} />
            </div>
          </div>

          {/* Visual: temperature gap */}
          <div className="bg-gradient-to-r from-red-50 to-blue-50 rounded-xl p-6 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-600">
                🔥 {form.accelerated_temperature_c}°C (accéléré)
              </span>
              <span className="text-sm font-medium text-blue-600">
                ❄️ {form.storage_temperature_c}°C (stockage)
              </span>
            </div>
            <div className="h-4 bg-gradient-to-r from-red-400 to-blue-400 rounded-full" />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Facteur Q10: {result.q10_value}x — La dégradation est {result.q10_value}x plus lente à {form.storage_temperature_c}°C
            </p>
          </div>
        </>
      )}
    </div>
  </div>
);

// ── Monte Carlo Tab ───────────────────────────────────────────────────

const MonteCarloTab: React.FC<{
  form: any;
  setForm: (f: (prev: any) => any) => void;
  result: MonteCarloResult | null;
  histogramData: any[];
  loading: boolean;
  onRun: () => void;
}> = ({ form, setForm, result, histogramData, loading, onRun }) => (
  <div className="space-y-6">
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-wrap gap-4 items-end">
      <InputField label="Ea moyenne (J/mol)" type="number" value={form.mean_activation_energy}
        onChange={(v) => setForm((f: any) => ({ ...f, mean_activation_energy: +v }))} />
      <InputField label="σ Ea (J/mol)" type="number" value={form.std_activation_energy}
        onChange={(v) => setForm((f: any) => ({ ...f, std_activation_energy: +v }))} />
      <InputField label="A moyenne" type="number" value={form.mean_pre_exponential}
        onChange={(v) => setForm((f: any) => ({ ...f, mean_pre_exponential: +v }))} />
      <InputField label="σ A" type="number" value={form.std_pre_exponential}
        onChange={(v) => setForm((f: any) => ({ ...f, std_pre_exponential: +v }))} />
      <InputField label="T (°C)" type="number" value={form.temperature_c}
        onChange={(v) => setForm((f: any) => ({ ...f, temperature_c: +v }))} />
      <InputField label="Simulations" type="number" value={form.n_simulations}
        onChange={(v) => setForm((f: any) => ({ ...f, n_simulations: +v }))} />

      <button onClick={onRun} disabled={loading}
        className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
        {loading ? "⏳..." : "🎲 Monte Carlo"}
      </button>
    </div>

    {result && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Résultats ({result.n_simulations} simulations)</h3>
          <div className="space-y-3">
            <ResultRow label="Shelf life moyen" value={`${result.mean_shelf_life_days} jours (${result.mean_shelf_life_months} mois)`} highlight />
            <ResultRow label="Écart-type" value={`${result.std_shelf_life_days} jours`} />
            <ResultRow label={`IC ${(result.confidence_level * 100).toFixed(0)}%`} value={`${result.ci_lower_days} — ${result.ci_upper_days} jours`} />
            <ResultRow label="IC (mois)" value={`${result.ci_lower_months} — ${result.ci_upper_months} mois`} />
            <ResultRow label="Min / Max" value={`${result.min_days} / ${result.max_days} jours`} />
          </div>
        </div>

        {/* Histogram */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Distribution de la Shelf Life</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bin" label={{ value: "Jours", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "Fréquence", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Bar dataKey="count" fill={COLORS.purple}>
                {histogramData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.bin >= result.ci_lower_days && entry.bin <= result.ci_upper_days
                      ? COLORS.primary : COLORS.purple + "60"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </div>
);

// ── Molecular Risk Tab ────────────────────────────────────────────────

const MolecularRiskTab: React.FC<{
  smiles: string;
  setSmiles: (s: string) => void;
  result: MolecularRisk | null;
  loading: boolean;
  onRun: () => void;
}> = ({ smiles, setSmiles, result, loading, onRun }) => (
  <div className="space-y-6">
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">⚗️ Risque de Dégradation Moléculaire</h2>
      <div className="flex gap-4">
        <input type="text" value={smiles} onChange={(e) => setSmiles(e.target.value)}
          placeholder="SMILES (ex: CC(=O)Oc1ccccc1C(=O)O)"
          className="flex-1 px-4 py-2 border rounded-lg font-mono text-sm" />
        <button onClick={onRun} disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "⏳..." : "⚗️ Analyser"}
        </button>
      </div>
    </div>

    {result && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Score de Stabilité Global</h3>
          <div className="flex items-center justify-center">
            <div className={`text-6xl font-bold ${
              result.overall_stability_score > 70 ? "text-green-500" :
              result.overall_stability_score > 40 ? "text-amber-500" : "text-red-500"
            }`}>
              {result.overall_stability_score}
            </div>
            <span className="text-2xl text-gray-400 ml-2">/100</span>
          </div>

          {/* Pathway risks */}
          <div className="mt-6 space-y-3">
            {Object.entries(result.pathway_risks).map(([pathway, risk]) => (
              <div key={pathway}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{pathway.replace(/_/g, " ")}</span>
                  <span className="font-mono">{risk}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full transition-all"
                    style={{
                      width: `${risk}%`,
                      backgroundColor: risk > 60 ? COLORS.danger : risk > 30 ? COLORS.warning : COLORS.success,
                    }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Functional Groups + Recommendations */}
        <div className="space-y-6">
          {result.functional_groups.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-3">Groupes Fonctionnels Détectés</h3>
              <div className="space-y-2">
                {result.functional_groups.map((fg, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <span className="text-lg">
                      {fg.risk === "hydrolysis" ? "💧" : fg.risk === "oxidation" ? "🔬" : "☀️"}
                    </span>
                    <div>
                      <div className="font-medium text-sm">{fg.name} (×{fg.count})</div>
                      <div className="text-xs text-gray-500">{fg.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-3">💡 Recommandations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="text-sm">{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}
  </div>
);

// ── Reusable Components ───────────────────────────────────────────────

const InputField: React.FC<{
  label: string;
  type?: string;
  value: any;
  onChange: (v: string) => void;
}> = ({ label, type = "text", value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: any;
  options: Array<{ v: any; l: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const KpiCard: React.FC<{
  label: string;
  value: string;
  unit: string;
  color: string;
}> = ({ label, value, unit, color }) => (
  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
    <div className="text-sm text-gray-500">{label}</div>
    <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
    <div className="text-xs text-gray-400">{unit}</div>
  </div>
);

const ResultRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-2 border-b last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className={`text-sm font-mono ${highlight ? "font-bold text-blue-600" : "text-gray-900"}`}>
      {value}
    </span>
  </div>
);

export default StabilitySimulator;
