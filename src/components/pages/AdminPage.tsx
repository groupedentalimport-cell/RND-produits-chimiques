'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Users, Microscope, FileText, ClipboardList,
  Plus, Settings, XCircle, CheckCircle2, Gauge, Brain, Activity,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  GRADIENT_TOP_BAR, COLOR_MAP, roleAvatarColors, roleLabels,
  ACTION_ICON_MAP, ACTION_COLOR_MAP, PROGRESS_BAR_MAP,
} from '@/lib/sample-data'

export function AdminPage() {
  const { toast } = useToast()
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [auditData, setAuditData] = useState<any[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditFacets, setAuditFacets] = useState<{ actions: any[]; tables: any[] }>({ actions: [], tables: [] })
  const [auditFilterAction, setAuditFilterAction] = useState('all')
  const [auditFilterTable, setAuditFilterTable] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'viewer', isActive: true })
  const [statsInfo, setStatsInfo] = useState<{ totalMolecules: number; activeStudies: number; totalReports: number; auditCount: number }>({ totalMolecules: 10, activeStudies: 3, totalReports: 5, auditCount: 6 })

  // Load stats + users
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/users'),
        ])
        if (!cancelled && statsRes.ok) {
          const data = await statsRes.json()
          setStatsInfo({
            totalMolecules: data.totalMolecules ?? 10,
            activeStudies: data.activeStudies ?? 3,
            totalReports: data.totalReports ?? 5,
            auditCount: data.totalReports ? (data.recentActivity?.length || 6) : 6,
          })
        }
        if (!cancelled && usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
      } catch { /* fallback */ }
      if (!cancelled) { setLoading(false); setUsersLoading(false) }
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  // Load audit logs (with debounce on search)
  useEffect(() => {
    setAuditLoading(true)
    const params = new URLSearchParams()
    if (auditFilterAction !== 'all') params.set('action', auditFilterAction)
    if (auditFilterTable !== 'all') params.set('table', auditFilterTable)
    if (auditSearch) params.set('q', auditSearch)
    params.set('limit', '50')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/audit-logs?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setAuditData(data.logs || [])
          setAuditTotal(data.pagination?.total ?? 0)
          setAuditFacets(data.facets || { actions: [], tables: [] })
        }
      } catch { /* ignore */ }
      setAuditLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [auditFilterAction, auditFilterTable, auditSearch, refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const startTraining = () => {
    setTrainingStatus('running')
    setTimeout(() => setTrainingStatus('done'), 3000)
  }

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({ name: '', email: '', role: 'viewer', isActive: true })
    setUserDialogOpen(true)
  }

  const openEditUser = (user: any) => {
    setEditingUser(user)
    setUserForm({ name: user.name || '', email: user.email, role: user.role, isActive: user.isActive })
    setUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.email.trim()) {
      toast({ title: 'Validation error', description: 'Email is required', variant: 'destructive' })
      return
    }
    setSavingUser(true)
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      if (res.ok) {
        toast({
          title: editingUser ? 'User updated' : 'User created',
          description: `${userForm.email} saved successfully`,
        })
        setUserDialogOpen(false)
        // Refresh users
        const refreshRes = await fetch('/api/users')
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setUsers(data.users || [])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: err.error || 'Failed to save user', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleUserStatus = async (user: any) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        toast({
          title: user.isActive ? 'User deactivated' : 'User activated',
          description: user.email,
        })
        setUsers(users.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      } else {
        toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  // actionIconMap and actionColorMap now use global maps
  // auditActionColors uses ACTION_TEXT_MAP

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Administration</h1>
          <p className="text-muted-foreground">Manage users, audit trail, ML training, and system configuration</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Organization Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: String(users.length || 5), icon: Users, color: 'emerald' },
          { label: 'Active Studies', value: String(statsInfo.activeStudies), icon: Microscope, color: 'teal' },
          { label: 'Reports Generated', value: String(statsInfo.totalReports), icon: FileText, color: 'cyan' },
          { label: 'Audit Events', value: String(auditTotal || statsInfo.auditCount), icon: ClipboardList, color: 'amber' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="backdrop-blur-sm bg-card/80 overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || 'bg-amber-500'}`} />
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${COLOR_MAP[stat.color]}`}><Icon className="size-4" /></div>
                <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold tabular-nums">{stat.value}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* User Management + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage platform users and roles</CardDescription>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openCreateUser}>
                <Plus className="size-4 mr-1" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {usersLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, idx) => (
                      <TableRow key={user.id} className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[inset_3px_0_0_0_rgb(16,185,129),0_4px_12px_-4px_rgba(16,185,129,0.2)] ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[user.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md shrink-0 ring-2 ring-white dark:ring-slate-900 ring-offset-1 ring-offset-emerald-500/20`}>
                              {(user.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{user.name || '(no name)'}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{roleLabels[user.role] || user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive
                            ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Active</Badge>
                            : <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center justify-end gap-1">
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditUser(user)}>
                                    <Settings className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit user</TooltipContent>
                              </UiTooltip>
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => handleToggleUserStatus(user)}
                                  >
                                    {user.isActive
                                      ? <XCircle className="size-3.5 text-red-500" />
                                      : <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    }
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{user.isActive ? 'Deactivate' : 'Activate'}</TooltipContent>
                              </UiTooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No users found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail with filters */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>Filtered system audit events ({auditTotal} total)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search details..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="text-xs h-8 flex-1 min-w-[120px]"
              />
              <Select value={auditFilterAction} onValueChange={setAuditFilterAction}>
                <SelectTrigger className="text-xs h-8 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="sign">Sign</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditFilterTable} onValueChange={setAuditFilterTable}>
                <SelectTrigger className="text-xs h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {auditFacets.tables.map((t: any) => (
                    <SelectItem key={t.table} value={t.table}>{t.table} ({t.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action facet chips */}
            {auditFacets.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {auditFacets.actions.map((a: any) => (
                  <button
                    key={a.action}
                    onClick={() => setAuditFilterAction(auditFilterAction === a.action ? 'all' : a.action)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      auditFilterAction === a.action
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted/40 border-border hover:bg-muted'
                    }`}
                  >
                    {a.action} <span className="font-semibold">{a.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Audit Timeline */}
            <div className="max-h-72 overflow-y-auto">
              {auditLoading ? (
                <div className="space-y-4 p-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : auditData.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-xs">
                  No audit events match your filters
                </p>
              ) : (
                <div className="space-y-0">
                  {auditData.map((entry, i) => {
                    const Icon = ACTION_ICON_MAP[entry.action] || Activity
                    const color = ACTION_COLOR_MAP[entry.action] || ACTION_COLOR_MAP.create
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.35, ease: 'easeOut' }}
                        className="flex gap-4 pb-6 relative"
                      >
                        <div className="flex flex-col items-center">
                          <div className={`size-8 rounded-full flex items-center justify-center ${color} shadow-sm`}><Icon className="size-4" /></div>
                          {i < auditData.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-border to-border/50 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium">{entry.details || `${entry.action} on ${entry.tableName}`}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">{entry.user?.name || entry.user?.email || 'System'}</span><span>·</span>
                            <Badge variant="outline" className="text-[10px] h-4">{entry.action}</Badge>
                            <Badge variant="outline" className="text-[10px] h-4 font-mono">{entry.tableName}</Badge><span>·</span>
                            <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Dashboard + System Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health Dashboard */}
        <Card className="gradient-border backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-emerald-600 dark:text-emerald-400" />
              System Health Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'ML Model Accuracy', value: 94.2, color: 'emerald', stroke: '#10b981' },
              { label: 'API Response Time', value: 97, color: 'teal', stroke: '#14b8a6' },
              { label: 'Database Integrity', value: 100, color: 'cyan', stroke: '#06b6d4' },
              { label: 'Storage Capacity', value: 78, color: 'amber', stroke: '#f59e0b' },
            ].map((item) => {
              const R = 18
              const C = 2 * Math.PI * R
              const pct = Math.max(0, Math.min(100, item.value))
              const offset = C * (1 - pct / 100)
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center gap-3">
                    {/* Circular progress ring around each health metric */}
                    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
                      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
                        <circle cx="22" cy="22" r={R} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/40" />
                        <circle
                          cx="22"
                          cy="22"
                          r={R}
                          fill="none"
                          stroke={item.stroke}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={C}
                          strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums" style={{ color: item.stroke }}>
                        {Math.round(item.value)}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="font-semibold">{item.value}%</span>
                    </div>
                  </div>
                  <Progress value={item.value} className={`h-1.5 ${PROGRESS_BAR_MAP[item.color] || '[&>div]:bg-amber-500'}`} />
                </div>
              )
            })}
            <Separator />
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-500/20 space-y-2 relative overflow-hidden">
              {/* Gradient header bar on ML model training sub-section */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" aria-hidden />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-300 dark:to-teal-300 bg-clip-text text-transparent">QSPR Stability Model</span>
                <Badge variant="outline" className="text-xs">{trainingStatus === 'done' ? 'Trained' : trainingStatus === 'running' ? 'Training...' : 'Ready'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Dataset:</span> <span className="font-medium">2,847 compounds</span></div>
                <div><span className="text-muted-foreground">Features:</span> <span className="font-medium">128 descriptors</span></div>
                <div><span className="text-muted-foreground">Last trained:</span> <span className="font-medium">2024-03-10</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-emerald-600 dark:text-emerald-400">Operational</span></div>
              </div>
              {trainingStatus === 'running' && <Progress value={66} className="h-2" />}
              {trainingStatus === 'done' && <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Training completed successfully</div>}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              onClick={startTraining}
              disabled={trainingStatus === 'running'}
            >
              {trainingStatus === 'running'
                ? <><RefreshCw className="size-4 animate-spin mr-2" /> Training in progress...</>
                : <><Brain className="size-4 mr-2" /> Retrain Model</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              System Configuration
            </CardTitle>
            <CardDescription>Platform settings and parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Default Temperature Unit', value: '°C (Celsius)' },
              { label: 'Risk Threshold — Low', value: 'Score ≥ 80' },
              { label: 'Risk Threshold — Moderate', value: 'Score 60–79' },
              { label: 'Risk Threshold — High', value: 'Score 40–59' },
              { label: 'Risk Threshold — Critical', value: 'Score < 40' },
              { label: 'Audit Retention Period', value: '7 years (FDA 21 CFR Part 11)' },
              { label: 'Session Timeout', value: '30 minutes' },
              { label: 'Data Encryption', value: 'AES-256' },
            ].map((cfg) => (
              <div key={cfg.label} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{cfg.label}</span>
                <span className="text-sm font-medium">{cfg.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* User Create/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingUser ? (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[editingUser.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md`}>
                  {(editingUser.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              ) : (<Users className="size-5 text-emerald-600 dark:text-emerald-400" />)}
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            {editingUser && <DialogDescription>Editing {editingUser.name || editingUser.email} — {roleLabels[editingUser.role] || editingUser.role}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            {!editingUser && userForm.name && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[userForm.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md`}>
                  {userForm.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </div>
                <span className="text-sm text-muted-foreground">Preview: {roleLabels[userForm.role] || userForm.role}</span>
              </div>
            )}
            <div><Label className="text-sm font-medium">Full Name *</Label><Input placeholder="e.g. Dr. Jane Smith" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={!userForm.name.trim() && userForm.email ? 'border-red-300 focus:border-red-500' : ''} />{!userForm.name.trim() && userForm.email && <p className="text-xs text-red-500 mt-1">Name is required</p>}</div>
            <div><Label className="text-sm font-medium">Email *</Label><Input type="email" placeholder="jane.smith@chemstab.io" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={!userForm.email.trim() ? 'border-red-300 focus:border-red-500' : ''} />{!userForm.email.trim() && <p className="text-xs text-red-500 mt-1">Email is required</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">Role</Label><Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="viewer">Viewer</SelectItem><SelectItem value="analyst">Analyst</SelectItem><SelectItem value="project_manager">Project Manager</SelectItem><SelectItem value="org_admin">Org Admin</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem></SelectContent></Select></div>
              <div><Label className="text-sm font-medium">Status</Label><Select value={userForm.isActive ? 'active' : 'inactive'} onValueChange={(v) => setUserForm({ ...userForm, isActive: v === 'active' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Badge variant="outline" className="text-xs">{roleLabels[userForm.role] || userForm.role}</Badge>
              {userForm.isActive ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveUser} disabled={savingUser || !userForm.name.trim() || !userForm.email.trim()}>
              {savingUser
                ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Saving...</>
                : <><Plus className="size-4 mr-2" /> {editingUser ? 'Save Changes' : 'Create User'}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
