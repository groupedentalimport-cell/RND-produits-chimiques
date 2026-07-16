/**
 * API Client — Centralized HTTP client for ChemStab backend.
 * Handles auth tokens, refresh, error handling, and request/response logging.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

interface RequestConfig {
  method: string;
  path: string;
  body?: any;
  params?: Record<string, string>;
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private async request<T>(config: RequestConfig): Promise<T> {
    const url = new URL(`${this.baseUrl}${config.path}`);
    if (config.params) {
      Object.entries(config.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = config.token || this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      method: config.method,
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Request failed", error);
    }

    return response.json();
  }

  // ── Auth ────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string }>({
      method: "POST",
      path: "/auth/login",
      body: { email, password },
    });
  }

  async register(email: string, password: string, fullName: string) {
    return this.request<{ id: string; email: string }>({
      method: "POST",
      path: "/auth/register",
      body: { email, password, full_name: fullName },
    });
  }

  // ── Stability ───────────────────────────────────────────────────────

  async simulate(params: any) {
    return this.request<{ status: string; simulation: any }>({
      method: "POST",
      path: "/stability/simulate",
      body: params,
    });
  }

  async runProtocol(params: any) {
    return this.request<{ status: string; simulations: any; summary: any }>({
      method: "POST",
      path: "/stability/protocol",
      body: params,
    });
  }

  async extrapolate(params: any) {
    return this.request<{ status: string; extrapolation: any }>({
      method: "POST",
      path: "/stability/extrapolate",
      body: params,
    });
  }

  async monteCarlo(params: any) {
    return this.request<{ status: string; monte_carlo: any }>({
      method: "POST",
      path: "/stability/monte-carlo",
      body: params,
    });
  }

  async molecularRisk(params: any) {
    return this.request<{ status: string; risk_assessment: any }>({
      method: "POST",
      path: "/stability/molecular-risk",
      body: params,
    });
  }

  async getConditions(zone?: string) {
    const path = zone ? `/stability/conditions/${zone}` : "/stability/conditions";
    return this.request<any>({ method: "GET", path });
  }

  // ── Studies ─────────────────────────────────────────────────────────

  async createStudy(params: any) {
    return this.request<{ status: string; study: any; simulation: any }>({
      method: "POST",
      path: "/stability/studies",
      body: params,
    });
  }

  async listStudies(params?: { project_id?: number; status?: string; study_type?: string }) {
    const query: Record<string, string> = {};
    if (params?.project_id) query.project_id = String(params.project_id);
    if (params?.status) query.status = params.status;
    if (params?.study_type) query.study_type = params.study_type;
    return this.request<any>({ method: "GET", path: "/stability/studies", params: query });
  }

  async getStudy(id: string) {
    return this.request<any>({ method: "GET", path: `/stability/studies/${id}` });
  }

  async updateStudyStatus(id: string, status: string, rejectionReason?: string) {
    return this.request<any>({
      method: "PUT",
      path: `/stability/studies/${id}/status`,
      body: { status, rejection_reason: rejectionReason },
    });
  }

  async signStudy(id: string, meaning: string) {
    return this.request<any>({
      method: "POST",
      path: `/stability/studies/${id}/sign`,
      body: { meaning },
    });
  }

  async addTimePoint(studyId: string, data: any) {
    return this.request<any>({
      method: "POST",
      path: `/stability/studies/${studyId}/timepoints`,
      body: data,
    });
  }

  async getStudyReport(id: string, format: string = "json") {
    return this.request<any>({
      method: "GET",
      path: `/stability/studies/${id}/report`,
      params: { format },
    });
  }

  // ── Molecules ───────────────────────────────────────────────────────

  async searchMolecules(query: string) {
    return this.request<any>({
      method: "GET",
      path: "/molecules/search",
      params: { q: query },
    });
  }

  async getMolecule(id: string) {
    return this.request<any>({ method: "GET", path: `/molecules/${id}` });
  }

  // ── Health ──────────────────────────────────────────────────────────

  async health() {
    return this.request<any>({ method: "GET", path: "/health" });
  }

  async version() {
    return this.request<any>({ method: "GET", path: "/version" });
  }
}

// ── Error class ───────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let client: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!client) {
    const getToken = () => localStorage.getItem("access_token");
    client = new ApiClient(API_BASE, getToken);
  }
  return client;
}

export default ApiClient;
