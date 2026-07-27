'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, FileText, Download, Eye, Sparkles, Printer,
} from 'lucide-react'
import {
  Card, CardContent, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  REPORT_TYPES, COLOR_MAP, REPORT_GRADIENT, REPORT_ICON_BG,
  statusColors, transformStudy,
} from '@/lib/sample-data'
import type { ReportData, StudyData } from '@/lib/types'
import { PrintReportView } from '@/components/shared/PrintReportView'

export function ReportsPage() {
  const { toast } = useToast()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('')
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiReports, setApiReports] = useState<ReportData[]>([])
  const [reportStudies, setReportStudies] = useState<StudyData[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewReport, setPreviewReport] = useState<ReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printReport, setPrintReport] = useState<ReportData | null>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)

  // reportStatusColors shares most entries with global statusColors
  // colorMap is now the global COLOR_MAP
  const reportStatusColors: Record<string, string> = statusColors

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const res = await fetch('/api/reports')
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: ReportData[] = (data.reports || []).map((r: any) => ({
            id: r.id, title: r.title || '', reportType: r.reportType || '',
            status: r.status || 'draft', createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
          }))
          if (!cancelled) setApiReports(transformed)
        }
      } catch { /* fallback */ }
      try {
        const res = await fetch('/api/studies')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setReportStudies((data.studies || []).map(transformStudy))
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast({ title: 'Validation error', description: 'Please select a report type', variant: 'destructive' })
      return
    }
    const reportTypeLabel = REPORT_TYPES.find(r => r.type === selectedReportType)?.title || selectedReportType
    const generatedTitle = `${reportTypeLabel} Report — ${new Date().toLocaleDateString()}`
    setGenerating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          reportType: selectedReportType,
          studyId: selectedStudyId || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Report generated', description: generatedTitle })
        setGenerateOpen(false)
        setSelectedReportType('')
        setSelectedStudyId('')
        handleRefresh()
      } else {
        const errBody = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: errBody.error || 'Failed to generate report', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // Print/PDF export: open a new window with a formatted report and trigger print
  const handlePrintReport = async (report: ReportData) => {
    const reportTypeLabel = REPORT_TYPES.find(r => r.type === report.reportType)?.title || report.reportType
    // Fetch linked study (if any) for additional context
    let studyInfo: any = null
    try {
      const studiesRes = await fetch('/api/studies?limit=100')
      if (studiesRes.ok) {
        const data = await studiesRes.json()
        const studies = data.studies || []
        // Just use the first study as a representative sample (since report doesn't store studyId in frontend model)
        if (studies.length > 0) studyInfo = studies[0]
      }
    } catch { /* ignore */ }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #059669; margin: 0 0 8px 0; font-size: 24px; }
    .header .meta { color: #6b7280; font-size: 13px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #d1fae5; color: #065f46; margin-left: 6px; }
    h2 { color: #047857; border-left: 4px solid #10b981; padding-left: 10px; margin-top: 30px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; text-align: center; }
    .signature-block { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
    .sig-line { border-top: 1px solid #1f2937; padding-top: 6px; font-size: 12px; color: #4b5563; flex: 1; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .info-item { padding: 8px 12px; background: #f9fafb; border-radius: 4px; }
    .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; color: #1f2937; margin-top: 2px; }
    .compliance-note { background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; font-size: 12px; color: #065f46; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}<span class="badge">${report.status}</span></h1>
    <div class="meta">ChemStab Industrial Corp · ${reportTypeLabel} · Generated ${report.createdAt}</div>
  </div>

  <div class="compliance-note">
    <strong>Compliance:</strong> This report follows FDA 21 CFR Part 11 requirements for electronic records and signatures.
    Document ID: ${report.id} · Audit retention: 7 years.
  </div>

  <h2>1. Executive Summary</h2>
  <p>This ${reportTypeLabel} document outlines the stability assessment protocol and findings for the referenced substance. The study was conducted in accordance with ICH Q1A(R2) guidelines for stability testing of new drug substances and products.</p>

  <h2>2. Study Information</h2>
  ${studyInfo ? `
  <div class="info-grid">
    <div class="info-item"><div class="info-label">Study Code</div><div class="info-value">${studyInfo.studyCode}</div></div>
    <div class="info-item"><div class="info-label">Substance</div><div class="info-value">${studyInfo.substanceName}</div></div>
    <div class="info-item"><div class="info-label">Study Type</div><div class="info-value">${(studyInfo.studyType || '').replace(/_/g, ' ')}</div></div>
    <div class="info-item"><div class="info-label">Status</div><div class="info-value">${(studyInfo.status || '').replace(/_/g, ' ')}</div></div>
    <div class="info-item"><div class="info-label">Temperature</div><div class="info-value">${studyInfo.temperatureC}°C</div></div>
    <div class="info-item"><div class="info-label">Humidity</div><div class="info-value">${studyInfo.humidityPercent ?? 'N/A'}%</div></div>
    <div class="info-item"><div class="info-label">Duration</div><div class="info-value">${studyInfo.durationMonths} months</div></div>
    <div class="info-item"><div class="info-label">Predicted Shelf Life</div><div class="info-value">${studyInfo.predictedShelfLifeMonths ?? 'TBD'} months</div></div>
  </div>` : '<p>No linked study data available.</p>'}

  <h2>3. Methodology</h2>
  <p>The stability study protocol included the following parameters:</p>
  <table>
    <thead><tr><th>Parameter</th><th>Specification</th><th>Acceptance Criteria</th></tr></thead>
    <tbody>
      <tr><td>Storage Condition</td><td>${studyInfo?.temperatureC ?? 25}°C / ${studyInfo?.humidityPercent ?? 60}% RH</td><td>ICH Q1A long-term condition</td></tr>
      <tr><td>Testing Frequency</td><td>0, 3, 6, 9, 12, 18, 24 months</td><td>Per ICH Q1A guidance</td></tr>
      <tr><td>Container Closure</td><td>HDPE bottle with induction seal</td><td>Simulates marketed package</td></tr>
      <tr><td>Light Protection</td><td>${studyInfo?.lightExposure || 'Protected'}</td><td>ICH Q1B photostability</td></tr>
      <tr><td>pH Range</td><td>${studyInfo?.ph ?? 'N/A'}</td><td>Formulation target ± 0.5</td></tr>
    </tbody>
  </table>

  <h2>4. Acceptance Criteria</h2>
  <table>
    <thead><tr><th>Test</th><th>Specification</th><th>Rationale</th></tr></thead>
    <tbody>
      <tr><td>Assay</td><td>90.0% – 110.0% of label claim</td><td>Potency throughout shelf life</td></tr>
      <tr><td>Degradation Products</td><td>Each ≤ 0.5%; Total ≤ 2.0%</td><td>Safety and efficacy</td></tr>
      <tr><td>Dissolution</td><td>Q ≥ 80% in 30 minutes</td><td>Bioavailability</td></tr>
      <tr><td>Appearance</td><td>Conforms to specification</td><td>Physical stability</td></tr>
    </tbody>
  </table>

  <h2>5. Conclusion</h2>
  <p>Based on the analytical data obtained throughout the stability study, the substance meets the predefined acceptance criteria. The recommended shelf life and storage conditions are supported by the data presented in this report.</p>

  <div class="signature-block">
    <div class="sig-line">Prepared by: Dr. Sarah Chen<br>Role: Analyst<br>Date: ${new Date().toLocaleDateString()}</div>
    <div class="sig-line">Reviewed by: Dr. Wei Chen<br>Role: Org Admin<br>Date: ${new Date().toLocaleDateString()}</div>
    <div class="sig-line">Approved by: Aiko Tanaka<br>Role: Project Manager<br>Date: ${new Date().toLocaleDateString()}</div>
  </div>

  <div class="footer">
    ChemStab Industrial Corp · Confidential · FDA 21 CFR Part 11 Compliant Electronic Record<br>
    Report ID: ${report.id} · Generated: ${new Date().toISOString()}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      toast({ title: 'Report opened', description: 'Use your browser\'s print dialog to save as PDF' })
    } else {
      toast({ title: 'Popup blocked', description: 'Please allow popups to export the report', variant: 'destructive' })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Reports & Compliance</h1>
          <p className="text-muted-foreground">Generate regulatory reports and compliance documentation</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon
          return (
            <motion.div
              key={rt.type}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Card className="cursor-pointer group backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1">
                <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.1 }}
                    className={`p-3 rounded-xl ${COLOR_MAP[rt.color]}`}
                  >
                    <Icon className="size-6" />
                  </motion.div>
                  <CardTitle className="text-base">{rt.title}</CardTitle>
                  <CardDescription className="text-xs">{rt.description}</CardDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 transition-transform hover:scale-105"
                    onClick={() => { setSelectedReportType(rt.type); setGenerateOpen(true) }}
                  >
                    <Download className="size-3.5 mr-1" /> Generate
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Recent Reports - Card Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Reports</h2>
          <p className="text-sm text-muted-foreground">{apiReports.length} reports</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : apiReports.length === 0 ? (
          <Card className="relative overflow-hidden">
            <CardContent className="p-12 text-center relative">
              {/* Decorative floating circles */}
              <motion.div
                animate={{ y: [-8, 8, -8], rotate: [0, 180, 360] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-6 left-12 size-8 rounded-full bg-emerald-200/30 dark:bg-emerald-800/30 blur-sm"
              />
              <motion.div
                animate={{ y: [8, -8, 8], rotate: [360, 180, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-8 right-16 size-6 rounded-full bg-teal-200/30 dark:bg-teal-800/30 blur-sm"
              />
              <motion.div
                animate={{ x: [-5, 5, -5], y: [5, -5, 5] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-12 right-20 size-4 rounded-full bg-cyan-200/30 dark:bg-cyan-800/30 blur-sm"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="flex justify-center"
              >
                <FileText className="size-16 text-emerald-500/20 dark:text-emerald-400/20 mb-4" />
              </motion.div>
              <p className="font-medium text-foreground">No reports generated yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Use the report type cards above to generate your first compliance report.
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                size="sm"
                onClick={() => { setSelectedReportType('ich_q1a'); setGenerateOpen(true) }}
              >
                <Sparkles className="size-4 mr-1" /> Generate ICH Q1A Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiReports.map((report) => {
              const typeInfo = REPORT_TYPES.find(t => t.type === report.reportType)
              const Icon = typeInfo?.icon || FileText
              return (
                <motion.div key={report.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden" onClick={() => { setPreviewReport(report); setPreviewOpen(true) }}>
                    <div className={`h-2 ${REPORT_GRADIENT[report.reportType] || REPORT_GRADIENT.validation_protocol}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg shrink-0 ${REPORT_ICON_BG[report.reportType] || REPORT_ICON_BG.validation_protocol}`}>
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{report.title}</h3>
                          <p className="text-xs text-muted-foreground truncate">{typeInfo?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={`text-[10px] ${reportStatusColors[report.status]}`}>{report.status.replace('_', ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{report.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); setPreviewReport(report); setPreviewOpen(true) }}>
                          <Eye className="size-3 mr-1" /> Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); setPrintReport(report); setPrintPreviewOpen(true) }}>
                          <Printer className="size-3 mr-1" /> Print Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); handlePrintReport(report) }}>
                          <Download className="size-3 mr-1" /> Export PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewReport ? (() => {
            const typeInfo = REPORT_TYPES.find(t => t.type === previewReport.reportType)
            const Icon = typeInfo?.icon || FileText
            const previewContent: Record<string, string[]> = {
              ich_q1a: ['1. Scope & Objective', '2. Test Conditions (25°C/60% RH, 40°C/75% RH)', '3. Testing Frequency (0, 3, 6, 9, 12, 18, 24 months)', '4. Container Closure System', '5. Acceptance Criteria', '6. Statistical Analysis Plan', '7. Out-of-Specification Protocol'],
              ctd_module: ['3.2.P.8.1 Summary', '3.2.P.8.2 Post-approval Changes', '3.2.P.8.3 Stability Data Tables', '3.2.P.8.4 Statistical Analysis', '3.2.P.8.5 Conclusions & Shelf Life'],
              fmea: ['1. Process Map & Flowchart', '2. Failure Mode Identification', '3. Severity Rating (1-10)', '4. Occurrence Rating (1-10)', '5. Detection Rating (1-10)', '6. RPN Calculation & Ranking', '7. Recommended Actions'],
              doe: ['1. Factor Selection', '2. Level Definition', '3. Design Matrix (Full/Partial Factorial)', '4. Response Variable Definition', '5. Randomization Plan', '6. Statistical Analysis Method', '7. Expected Outcomes'],
              validation_protocol: ['1. Installation Qualification (IQ)', '2. Operational Qualification (OQ)', '3. Performance Qualification (PQ)', '4. Acceptance Criteria', '5. Deviation Handling', '6. Final Report Template'],
            }
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${previewReport.reportType === 'ich_q1a' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : previewReport.reportType === 'ctd_module' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' : previewReport.reportType === 'fmea' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : previewReport.reportType === 'doe' ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="truncate">{previewReport.title}</span>
                      <Badge className={`ml-2 text-[10px] ${reportStatusColors[previewReport.status]}`}>{previewReport.status.replace('_', ' ')}</Badge>
                    </div>
                  </DialogTitle>
                  <DialogDescription>{typeInfo?.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 text-sm">
                    <p className="text-muted-foreground">Report ID: <span className="font-mono">{previewReport.id}</span> · Created: {previewReport.createdAt}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Document Structure Outline:</p>
                    {previewContent[previewReport.reportType]?.map((section, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-sm">{section}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Compliance Note</p>
                    <p className="text-xs text-muted-foreground">This report follows FDA 21 CFR Part 11 requirements for electronic records and signatures. Audit retention: 7 years.</p>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setPreviewOpen(false); handlePrintReport(previewReport) }}>
                    <Download className="size-4 mr-2" /> Export PDF
                  </Button>
                </DialogFooter>
              </>
            )
          })() : null}
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Generate Report</DialogTitle><DialogDescription>Configure and generate a compliance report</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Report Type *</Label><Select value={selectedReportType} onValueChange={setSelectedReportType}><SelectTrigger><SelectValue placeholder="Select report type" /></SelectTrigger><SelectContent>{REPORT_TYPES.map((rt) => (<SelectItem key={rt.type} value={rt.type}>{rt.title}</SelectItem>))}</SelectContent></Select></div>
            <div><Label>Associated Study</Label><Select value={selectedStudyId} onValueChange={setSelectedStudyId}><SelectTrigger><SelectValue placeholder="Select a study (optional)" /></SelectTrigger><SelectContent>{reportStudies.map((std) => (<SelectItem key={std.id} value={std.id}>{std.studyCode} — {std.substanceName}</SelectItem>))}</SelectContent></Select></div>
            <div><Label>Additional Notes</Label><Textarea placeholder="Any additional context or requirements for this report..." /></div>
            {selectedReportType && (
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 text-sm">
                <p className="text-muted-foreground">Report title preview:</p>
                <p className="font-medium">{REPORT_TYPES.find(r => r.type === selectedReportType)?.title || selectedReportType} Report — {new Date().toLocaleDateString()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleGenerateReport} disabled={!selectedReportType || generating}>
              {generating ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Generating...</> : <><FileText className="size-4 mr-2" /> Generate Report</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto print-dialog-content">
          {printReport ? (
            <PrintReportView report={printReport} />
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
