import React, { useState, useEffect } from 'react';
import {
  FlaskConical, Shield, Database, BarChart3, FileText, Settings,
  Activity, Atom, Search, Plus, Download, ChevronRight, AlertTriangle,
  CheckCircle, Clock, Beaker, TrendingUp, Lock
} from 'lucide-react';

// Types
interface Molecule {
  id: number;
  name: string;
  chembl_id?: string;
  smiles?: string;
  formula?: string;
  molar_mass?: number;
  logp?: number;
  predicted_stability_score?: number;
  prediction_confidence?: number;
  data_source?: string;
}

interface RiskResult {
  icon: string;
  name: string;
  score: number;
  severity: string;
  description: string;
  factors: any[];
  recommendations: string[];
}

interface AnalysisResult {
  analysis_id: number;
  overall_score: number;
  risk_level: string;
  risks: Record<string, RiskResult>;
  recommendations: string[];
  kinetics: any;
  qspr_predictions: any;
}

// API helper
const API = '/api/v1';
const api = {
  async fetch(path: string, options?: RequestInit) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    return res;
  },
  async get(path: string) { return this.fetch(path); },
  async post(path: string, body: any) {
    return this.fetch(path, { method: 'POST', body: JSON.stringify(body) });
  },
};

// Severity colors
const severityColor: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  moderate: 'bg-yellow-500',
  low: 'bg-green-500',
};
const severityText: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  moderate: 'text-yellow-400',
  low: 'text-green-400',
};

// ── Dashboard Component ────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/molecules/stats/database').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">ChemStab Industrial</h1>
          <p className="text-slate-400 mt-1">Chemical Stability Assessment Platform v5.1</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm">System Online</span>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Atom className="w-6 h-6" />, title: 'QSPR Predictions', desc: 'ML-based molecular property prediction', color: 'text-blue-400' },
          { icon: <Shield className="w-6 h-6" />, title: 'GxP Audit Trail', desc: '21 CFR Part 11 compliant', color: 'text-green-400' },
          { icon: <Database className="w-6 h-6" />, title: 'ChEMBL Integration', desc: `${stats?.total_molecules || 0} molecules`, color: 'text-purple-400' },
          { icon: <FileText className="w-6 h-6" />, title: 'ICH/FDA Reports', desc: 'Regulatory-compliant exports', color: 'text-orange-400' },
        ].map((f, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
            <div className={`${f.color} mb-3`}>{f.icon}</div>
            <h3 className="text-white font-semibold">{f.title}</h3>
            <p className="text-slate-400 text-sm mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Database stats */}
      {stats && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            Chemical Database
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Molecules', value: stats.total_molecules, color: 'text-blue-400' },
              { label: 'With ChEMBL ID', value: stats.with_chembl_id, color: 'text-green-400' },
              { label: 'With Descriptors', value: stats.with_descriptors, color: 'text-purple-400' },
              { label: 'Data Sources', value: Object.keys(stats.by_source || {}).length, color: 'text-orange-400' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: <Search className="w-4 h-4" />, label: 'Search Molecules', href: '/molecules' },
            { icon: <Plus className="w-4 h-4" />, label: 'New Analysis', href: '/analysis' },
            { icon: <Download className="w-4 h-4" />, label: 'Import from ChEMBL', href: '/admin/import' },
          ].map((a, i) => (
            <button key={i} className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left">
              <div className="text-blue-400">{a.icon}</div>
              <span className="text-white">{a.label}</span>
              <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Molecule Browser ───────────────────────────────────────────────────
function MoleculeBrowser() {
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/molecules?limit=50`).then(r => r.json()).then(setMolecules).finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    const res = await api.post('/molecules/search', { query: search, limit: 50 });
    const data = await res.json();
    setMolecules(data.molecules || []);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Database className="w-6 h-6 text-purple-400" />
        Chemical Database
      </h1>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name, CAS, SMILES, ChEMBL ID..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button onClick={handleSearch} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors">
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              {['Name', 'Formula', 'MW (g/mol)', 'LogP', 'Stability', 'Confidence', 'Source'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : molecules.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No molecules found</td></tr>
            ) : molecules.map(mol => (
              <tr key={mol.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{mol.name}</div>
                  {mol.chembl_id && <div className="text-xs text-blue-400">{mol.chembl_id}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 font-mono">{mol.formula || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{mol.molar_mass?.toFixed(2) || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-300">{mol.logp?.toFixed(2) || '—'}</td>
                <td className="px-4 py-3">
                  {mol.predicted_stability_score != null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${mol.predicted_stability_score > 70 ? 'bg-green-500' : mol.predicted_stability_score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${mol.predicted_stability_score}%` }} />
                      </div>
                      <span className="text-sm text-slate-300">{mol.predicted_stability_score.toFixed(0)}</span>
                    </div>
                  ) : <span className="text-slate-500 text-sm">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">{mol.prediction_confidence ? `${(mol.prediction_confidence * 100).toFixed(0)}%` : '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">{mol.data_source || 'manual'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analysis Form ──────────────────────────────────────────────────────
function AnalysisPage() {
  const [substances, setSubstances] = useState([{ name: '', concentration: 10, concentration_unit: 'g/L' }]);
  const [conditions, setConditions] = useState({ ph: 7, temperature: 25, dissolved_oxygen: 8, light_exposure: 0, uv_exposure: 0, inert_atmosphere: 'none' });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);

  const addSubstance = () => setSubstances([...substances, { name: '', concentration: 10, concentration_unit: 'g/L' }]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await api.post('/analysis/run', {
        project_id: 1,
        substances: substances.filter(s => s.name),
        ...conditions,
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <FlaskConical className="w-6 h-6 text-blue-400" />
        Stability Analysis
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-3">Substances</h2>
            {substances.map((s, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  placeholder="Name (e.g., Ascorbic Acid)"
                  value={s.name}
                  onChange={e => { const ns = [...substances]; ns[i].name = e.target.value; setSubstances(ns); }}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  type="number"
                  placeholder="Conc."
                  value={s.concentration}
                  onChange={e => { const ns = [...substances]; ns[i].concentration = +e.target.value; setSubstances(ns); }}
                  className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  value={s.concentration_unit}
                  onChange={e => { const ns = [...substances]; ns[i].concentration_unit = e.target.value; setSubstances(ns); }}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm"
                >
                  {['g/L', 'mg/L', '%', 'mol/L', 'ppm'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            ))}
            <button onClick={addSubstance} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-2">
              <Plus className="w-4 h-4" /> Add substance
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-3">Conditions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ph', label: 'pH', min: 0, max: 14, step: 0.1 },
                { key: 'temperature', label: 'Temperature (°C)', min: -20, max: 200, step: 1 },
                { key: 'dissolved_oxygen', label: 'Dissolved O₂ (mg/L)', min: 0, max: 20, step: 0.5 },
                { key: 'light_exposure', label: 'Light (lux)', min: 0, max: 10000, step: 100 },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-slate-400">{f.label}</label>
                  <input
                    type="number"
                    value={(conditions as any)[f.key]}
                    min={f.min} max={f.max} step={f.step}
                    onChange={e => setConditions({ ...conditions, [f.key]: +e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={running}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {running ? <Clock className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
            {running ? 'Running...' : 'Run Analysis'}
          </button>
        </div>

        {/* Results panel */}
        <div className="space-y-4">
          {result && (
            <>
              {/* Overall score */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Overall Score</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${severityText[result.risk_level]} bg-slate-700`}>
                    {result.risk_level.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold text-white">{result.overall_score.toFixed(1)}</div>
                  <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${result.overall_score > 70 ? 'bg-green-500' : result.overall_score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${result.overall_score}%` }} />
                  </div>
                </div>
              </div>

              {/* Risk breakdown */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-white mb-3">Risk Assessment</h2>
                <div className="space-y-2">
                  {Object.entries(result.risks).map(([key, risk]) => (
                    <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30">
                      <span className="text-lg">{risk.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm text-white">{risk.name}</div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                          <div className={`h-full rounded-full ${severityColor[risk.severity]}`} style={{ width: `${risk.score}%` }} />
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${severityText[risk.severity]}`}>{risk.score.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kinetics */}
              {result.kinetics && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Kinetic Prediction
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Shelf Life</span>
                      <div className="text-white font-semibold">{result.kinetics.shelf_life_months || '—'} months</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Q10 Factor</span>
                      <div className="text-white font-semibold">{result.kinetics.q10 || '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-3">Recommendations</h2>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const form = new URLSearchParams();
      form.append('username', username);
      form.append('password', password);
      const res = await fetch(`${API}/auth/login`, { method: 'POST', body: form });
      if (!res.ok) { setError('Invalid credentials'); return; }
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      onLogin(data.access_token);
    } catch { setError('Connection failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <FlaskConical className="w-12 h-12 text-blue-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white mt-3">ChemStab Industrial</h1>
          <p className="text-slate-400 text-sm mt-1">Chemical Stability Platform</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white mt-1" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white mt-1" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> 21 CFR Part 11 compliant authentication
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [page, setPage] = useState('dashboard');

  if (!token) return <LoginPage onLogin={setToken} />;

  const navItems = [
    { id: 'dashboard', icon: <BarChart3 className="w-5 h-5" />, label: 'Dashboard' },
    { id: 'molecules', icon: <Database className="w-5 h-5" />, label: 'Molecules' },
    { id: 'analysis', icon: <FlaskConical className="w-5 h-5" />, label: 'Analysis' },
  ];

  const pages: Record<string, JSX.Element> = {
    dashboard: <Dashboard />,
    molecules: <MoleculeBrowser />,
    analysis: <AnalysisPage />,
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <nav className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8 px-2">
          <FlaskConical className="w-8 h-8 text-blue-400" />
          <div>
            <div className="text-white font-bold">ChemStab</div>
            <div className="text-xs text-slate-400">Industrial v5.1</div>
          </div>
        </div>
        <div className="space-y-1 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${page === item.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { localStorage.removeItem('token'); setToken(null); }}
          className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-400 text-sm transition-colors"
        >
          Sign Out
        </button>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {pages[page] || <Dashboard />}
      </main>
    </div>
  );
}
