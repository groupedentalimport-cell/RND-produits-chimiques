# Task 5-b: Simulator Page & Global UI Enhancements

## Agent: full-stack-developer

## Summary
Enhanced the Simulator page with multi-step progress indicators, radar chart, degradation curve preview, environmental condition severity indicators, and animated empty state. Added custom scrollbar CSS and breadcrumb navigation to the header.

## Files Modified
- `/home/z/my-project/src/app/page.tsx` — All SimulatorPage enhancements + Home() breadcrumb
- `/home/z/my-project/src/app/globals.css` — Custom scrollbar styling

## Key Changes

### A1: Simulation Progress Steps
- Added `SIM_STEPS` constant (4 steps)
- Added `currentStep` state with `setCurrentStep(0)` at start, increment via setTimeout
- Replaced spinner with animated multi-step progress indicator using CheckCircle2/RefreshCw/Clock icons
- Progress bar shows `(currentStep / SIM_STEPS.length) * 100`

### A2: Radar Chart for Risk Breakdown
- Added RadarChart with PolarGrid, PolarAngleAxis, PolarRadiusAxis after existing Progress bars
- Emerald stroke/fill (#10b981) with fillOpacity 0.3

### A3: Degradation Curve Preview
- Added `useMemo` import + `degradationCurveData` computation
- Exponential decay model from shelf life kinetics
- Line chart with concentration (emerald) and threshold (red dashed) lines

### A4: Environmental Condition Indicators
- Added `getConditionSeverity()` helper with type-specific thresholds
- Colored dots + labels next to each condition input (pH, Temperature, Dissolved O₂, Light Exposure)

### A5: Animated Empty State
- 3 floating circles with framer-motion animations
- Beaker icon with spring animation
- Better typography and messaging

### B1: Custom Scrollbar CSS
- 6px width, transparent track, oklch-based thumb colors, rounded

### B2: Breadcrumb in Header
- Added `currentPage` from useAppStore to Home()
- "ChemStab > {page name}" breadcrumb with ChevronRight separator

## Verification
- `bun run lint` passed cleanly
- Dev server running without errors
