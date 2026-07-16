/**
 * App Router — React Router v6 with protected routes and layout.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import StabilitySimulator from "../StabilitySimulator";

// ── Layout with Sidebar ───────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-blue-600">⚗️ ChemStab</h1>
          <p className="text-xs text-gray-400">Industrial v5.3</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" icon="📊" label="Dashboard" />
          <NavLink to="/simulator" icon="🧪" label="Simulateur" />
          <NavLink to="/studies" icon="📋" label="Études" />
          <NavLink to="/molecules" icon="🔬" label="Molécules" />
          <NavLink to="/reports" icon="📈" label="Rapports" />
          {user?.role === "org_admin" || user?.role === "super_admin" ? (
            <NavLink to="/admin" icon="⚙️" label="Admin" />
          ) : null}
        </nav>

        <div className="p-4 border-t">
          <div className="text-sm">
            <div className="font-medium">{user?.full_name || user?.email}</div>
            <div className="text-xs text-gray-400 capitalize">{user?.role?.replace("_", " ")}</div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="mt-2 text-sm text-red-500 hover:text-red-700"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
    >
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

// ── Protected Route ───────────────────────────────────────────────────

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">403 — Accès refusé</h2>
          <p className="text-gray-500 mt-2">Vous n'avez pas les permissions nécessaires.</p>
        </div>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
}

// ── Pages ─────────────────────────────────────────────────────────────

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">⚗️ ChemStab Industrial</h1>
          <p className="text-gray-500 text-sm mt-1">Connexion sécurisée</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required minLength={12}
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    // Fetch basic stats
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🧪" label="Simulations" value="--" color="blue" />
        <StatCard icon="📋" label="Études actives" value="--" color="green" />
        <StatCard icon="🔬" label="Molécules" value="--" color="purple" />
        <StatCard icon="⚠️" label="Alertes" value="--" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Actions rapides</h3>
          <div className="space-y-2">
            <QuickAction to="/simulator" icon="🧪" label="Lancer une simulation" />
            <QuickAction to="/studies" icon="📋" label="Voir les études" />
            <QuickAction to="/molecules" icon="🔬" label="Rechercher une molécule" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Système</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-mono">v5.3.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Utilisateur</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rôle</span>
              <span className="capitalize">{user?.role?.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Status</span>
              <span className={stats?.status === "healthy" ? "text-green-600" : "text-gray-400"}>
                {stats?.status || "Vérification..."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudiesPage() {
  const [studies, setStudies] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch("/api/v1/stability/studies", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setStudies(data.studies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Études de Stabilité</h2>
        <Link
          to="/simulator"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nouvelle étude
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : studies.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-4">📋</p>
          <p>Aucune étude pour le moment</p>
          <Link to="/simulator" className="text-blue-600 text-sm mt-2 inline-block">
            Créer votre première étude →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Substance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">T°C</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Shelf Life</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {studies.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{s.study_code}</td>
                  <td className="px-4 py-3 text-sm">{s.substance_name}</td>
                  <td className="px-4 py-3 text-sm capitalize">{s.study_type?.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm">{s.temperature_c}°C</td>
                  <td className="px-4 py-3 text-sm">
                    {s.predicted_shelf_life_months
                      ? `${s.predicted_shelf_life_months.toFixed(1)} mois`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MoleculesPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Base de Molécules</h2>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-gray-500">Recherche de molécules par nom, CAS, ou SMILES.</p>
        <input
          type="text"
          placeholder="Rechercher... (ex: Aspirin, 50-78-2, CC(=O)Oc1ccccc1C(=O)O)"
          className="mt-4 w-full px-4 py-2 border rounded-lg"
        />
      </div>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Rapports</h2>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-gray-500">Génération de rapports ICH, CTD, et rapports personnalisés.</p>
      </div>
    </div>
  );
}

function AdminPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Administration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">👥 Utilisateurs</h3>
          <p className="text-sm text-gray-500">Gestion des utilisateurs et des rôles.</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">📊 Audit Trail</h3>
          <p className="text-sm text-gray-500">Consultation du journal d'audit GxP.</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">🤖 Entraînement ML</h3>
          <p className="text-sm text-gray-500">Lancer l'entraînement des modèles QSPR.</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">🔧 Configuration</h3>
          <p className="text-sm text-gray-500">Paramètres système et intégrations.</p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className={`text-xl font-bold text-${color}-600`}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <span className="text-xl">{icon}</span>
      <span className="text-sm">{label}</span>
      <span className="ml-auto text-gray-400">→</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    under_review: "bg-yellow-100 text-yellow-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
      {status?.replace("_", " ")}
    </span>
  );
}

// ── Router ────────────────────────────────────────────────────────────

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/simulator" element={<ProtectedRoute permission="execute:analysis"><StabilitySimulator /></ProtectedRoute>} />
          <Route path="/studies" element={<ProtectedRoute><StudiesPage /></ProtectedRoute>} />
          <Route path="/molecules" element={<ProtectedRoute><MoleculesPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute permission="manage:users"><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
