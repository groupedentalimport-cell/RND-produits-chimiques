# Task 5 — Stability Prediction Calculator

**Agent**: full-stack-developer
**Task**: Create an Arrhenius-based Stability Prediction Calculator for the ChemStab platform
**Date**: 2026-03-04
**Status**: Completed

## Summary

Added a scientific Stability Prediction Calculator to the ChemStab platform that uses the Arrhenius equation to predict shelf life and degradation kinetics under custom temperature conditions. The calculator consists of a new API endpoint and a polished client-side component, integrated into the Simulator page.

## What was done

### 1. New API endpoint — `src/app/api/stability-calculator/route.ts`

- **POST** `/api/stability-calculator` accepts:
  ```ts
  {
    activationEnergy: number;   // kJ/mol
    rateConstant25C: number;    // 1/months
    temperatureC: number;       // °C
    durationMonths: number;     // months
    kineticOrder: 0 | 1 | 2;
  }
  ```
- Implements the Arrhenius equation: `k₂ = k₁ · exp((Eₐ/R) · (1/T₁ − 1/T₂))`
  - R = 8.314 J·mol⁻¹·K⁻¹
  - T₁ = 298.15 K (25°C reference)
  - T₂ = temperatureC + 273.15
  - Eₐ converted from kJ/mol to J/mol internally for unit consistency
- Computes per kinetic order:
  - Zero-order:   `D = k·t`  (capped at 1)
  - First-order:  `D = 1 − exp(−k·t)`
  - Second-order: `D = k·t / (1 + k·t)`
- Returns predicted shelf life (time to 10% degradation, ICH Q1A threshold), remaining potency %, Q₁₀, Arrhenius factor (k₂/k₁), and a 51-point degradation curve.
- Strict input validation: type + NaN + Infinity + range checks on every parameter. Returns 400 with a `details` array on failure.
- **GET** endpoint returns formula reference + default values documentation.

### 2. New shared component — `src/components/shared/StabilityCalculator.tsx`

- 'use client' component, emerald/teal color scheme (NO indigo/blue, compliant with project rules).
- Two-column Card layout that collapses to single column on mobile.
- **Inputs**:
  - Activation Energy (Eₐ) — slider (50–150) + number input, default 100 kJ/mol
  - Rate Constant at 25°C (k₂₅) — logarithmic slider (0.001–0.1) + number input, default 0.01 1/months
  - Storage Temperature — slider (4–60°C) + number input, default 25°C
  - Duration — slider (1–36 months) + number input, default 12 months
  - Kinetic Order — three-button ToggleGroup (Zero / First / Second-order)
- **Results panel**:
  - Large gradient headline showing predicted shelf life (months or years+months, "∞" if stable)
  - Animated SVG circular gauge for Remaining Potency (color-coded)
  - Degradation percentage with animated Progress bar + color-coded legend
  - Three small stat cards: k at target temperature, Arrhenius factor (k₂/k₁), Q₁₀
  - LineChart (recharts) showing degradation (red) + potency (emerald) over time with:
    - Horizontal red dashed reference line at the 10% shelf-life threshold
    - Vertical teal dashed reference line at the user-selected duration
    - CartesianGrid, XAxis (months), YAxis (%), Tooltip with formatted values
  - "Save as Study" button → toast notification + `useAppStore.setPage('studies')`
- **Formula Reference** expandable Accordion section showing:
  - The Arrhenius equation in monospace form
  - Constant definitions (R, T₁, T₂, Eₐ unit conversion note)
  - All three kinetic-order degradation formulas
  - Shelf-life definition per ICH Q1A
- Auto-computes on parameter change (250 ms debounce) via POST to the new API.
- All numbers formatted with appropriate significant figures (scientific notation for very small k values).

### 3. Integrated into Simulator page — `src/components/pages/SimulatorPage.tsx`

- Imported `StabilityCalculator` from shared components.
- Added the calculator as a new section below the existing simulator content (substances + conditions + results grid).
- Wrapped the section with an "ICH Q1A" Badge + descriptive subtitle for context.
- Existing SimulatorPage functionality fully preserved: substances form, environmental conditions, run-analysis button, multi-step loading animation, overall stability score gauge, risk breakdown radar chart, kinetics predictions, recommendations, and animated empty state.

## Verification

### API tests (curl, realistic pharmaceutical values)

| Scenario | Input | Result | Match? |
|---|---|---|---|
| Reference (25°C, first-order) | Ea=100, k=0.01, T=25, t=12, order=1 | k=0.01, 11.3% degradation, 10.5 mo shelf life, Q₁₀=3.70 | ✓ Matches expected `0.10536/0.01 = 10.54 mo` |
| Accelerated (40°C) | Ea=100, k=0.01, T=40, t=12, order=1 | k=0.069, 56.3% degradation, 1.53 mo shelf life, Q₁₀=3.28 | ✓ Typical pharma Q₁₀ is 2–4 |
| Cold storage (4°C, second-order) | Ea=80, k=0.005, T=4, t=24, order=2 | k=0.00043, 1.03% degradation, 256 mo shelf life | ✓ Cold chain extends shelf life |
| Invalid input (negative Ea) | Ea=−5 | 400 with `{ error: "Validation failed", details: [...] }` | ✓ Validation works |

### Lint

- `bun run lint` → **0 errors, 6 warnings** (all 6 warnings are pre-existing in `use-realtime-notifications.ts`, unrelated to this task).

### Dev server log

- `POST /api/stability-calculator 200 in 9ms (compile: 5ms, render: 5ms)`
- `POST /api/stability-calculator 400 in 6ms` (validation path)
- `GET / 200 in 848ms` (Simulator page compiles with the new section)

## Files added/modified

- **NEW** `src/app/api/stability-calculator/route.ts` — 230 lines, POST + GET endpoints
- **NEW** `src/components/shared/StabilityCalculator.tsx` — ~750 lines, full calculator UI
- **MODIFIED** `src/components/pages/SimulatorPage.tsx` — added import + 12-line section integration

## Notes for future agents

- The API is fully stateless and self-contained — no Prisma/db involvement. Could be reused as a micro-service if needed.
- The component auto-computes via a 250 ms debounce; no manual "Calculate" button is needed.
- The logarithmic slider for rate constant uses `Math.pow(10, -3 + (sliderValue/1000) * 2)` to map slider 0–1000 to k ∈ [0.001, 0.1].
- The circular gauge, progress bar, and chart all use color-coded thresholds (green < 5%, teal 5–10%, amber 10–20%, red > 20%) to align with typical pharmaceutical stability classification.
- "Save as Study" currently navigates the user to the Studies page and shows a toast with the predicted shelf life summary. A future iteration could pre-fill the Create Study dialog with the calculator's parameters.
