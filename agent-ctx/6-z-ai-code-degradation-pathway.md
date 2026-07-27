# Task 6 — Interactive Degradation Pathway Visualization

**Agent**: Z.ai Code (fullstack)
**Task ID**: 6
**Date**: 2025-03-04
**Status**: Completed

## Summary

Added an interactive degradation pathway visualization to the ChemStab platform. The new `DegradationPathway` shared component renders a tree/flowchart diagram showing a parent molecule at the top, SVG connector arrows branching down to degradation products (color-coded by stress condition), and product cards with 2D structures, percentage yield, and hazard-level badges. The component is integrated into both the Degradation page (with a molecule selector) and the Molecules page detail dialog (Degradation tab).

## Files Created / Modified

### 1. `src/lib/sample-data.ts` — added `DEGRADATION_PATHWAYS` constant

**New exports added** (appended at the end of the file, ~210 lines):

- `DegradationCondition` type — `'Hydrolysis' | 'Oxidation' | 'Photolysis' | 'Thermal'`
- `HazardLevel` type — `'low' | 'moderate' | 'high'`
- `DegradationPathwayProduct` interface — `{ name, smiles, percentage, hazardLevel, condition, description? }`
- `DegradationPathway` interface — `{ moleculeName, smiles, casNumber?, formula?, products: DegradationPathwayProduct[] }`
- `DEGRADATION_PATHWAYS: DegradationPathway[]` constant — 5 predefined pathways:
  - **Aspirin** → hydrolysis → Salicylic Acid (65%, moderate) + Acetic Acid (35%, low)
  - **Ibuprofen** → oxidation → Hydroxyibuprofen (42%, low), thermal → Isobutylphenol (18%, moderate)
  - **Acetaminophen** → oxidation → NAPQI (12%, high), hydrolysis → p-Aminophenol (28%, moderate)
  - **Hydrogen Peroxide** → photolysis → Water + Oxygen (50% each), thermal → Water + Oxygen (50% each)
  - **Caffeine** → photolysis → Dimethylparabanic Acid (22%, moderate)
  - Each pathway includes parent SMILES, CAS number, formula, and per-product condition + scientific description
- `DEGRADATION_CONDITION_STYLES: Record<DegradationCondition, {badge, dot, stroke, label}>` — color tokens:
  - Hydrolysis → teal
  - Oxidation → amber
  - Photolysis → cyan
  - Thermal → red
  (NO indigo/blue, per project styling rule)
- `HAZARD_BADGE_STYLES: Record<HazardLevel, string>` — color tokens: low=emerald, moderate=amber, high=red
- `findPathwayForMolecule(name)` helper — case-insensitive lookup by molecule name (used by MoleculesPage to fall back to a predefined pathway)

### 2. `src/components/shared/DegradationPathway.tsx` — new shared component (~415 lines)

- `'use client'` component
- Props: `moleculeName: string`, `smiles?: string`, `casNumber?: string`, `formula?: string`, `degradationProducts?: DegradationProductInput[]`, `compact?: boolean`, `className?: string`
- **Parent molecule card** at top (centered) — emerald gradient bg, Atom icon, name + "Parent" badge, formula + CAS line, and a `MoleculeStructure` 2D rendering below
- **SVG connector area** (64px tall, ResizeObserver-driven):
  - Vertical stem from parent center down to a horizontal bus at y=22
  - Horizontal bus line spanning first-row product centers
  - Per-product vertical drop lines (color-coded by condition: teal/amber/cyan/red) ending in arrowheads at y=50
  - Condition label pills (HTML overlay) centered on each drop line — small `bg-background/95` pills with colored dot + condition name
- **Product cards grid** — responsive `repeat(N, 1fr)` columns where N is computed from container width (1 col < 480px, 2 cols < 768px, 3 cols < 1280px, up to 4 on XL):
  - Top color bar matching the condition color
  - Product name + condition badge
  - `MoleculeStructure` 2D rendering (compact: 200×90, normal: 240×110)
  - Percentage badge (emerald) + hazard-level badge (color-coded)
  - Optional description (hidden in compact mode)
  - "No structure" fallback for products without SMILES
- **Framer-motion animations**: staggered fade-in + slide-down. Parent animates first (delay=0), then each product card animates with delay=0.15+i*0.08s. Legend (non-compact only) fades in last.
- **Empty state**: dashed-border card with floating circles, large FlaskConical icon in emerald circle, and a friendly message naming the molecule
- **Legend** (non-compact only): row showing all 4 condition color dots + a ChevronDown indicator explaining arrow direction
- Robust normalization helpers (`normalizeCondition`, `normalizeHazard`) handle missing/unknown condition or hazard strings

### 3. `src/components/pages/DegradationPage.tsx` — added top visualization section

- Added imports: `Network`, `ChevronDown` icons; `DEGRADATION_PATHWAYS` data; `DegradationPathway` component
- Added state: `selectedPathwayIdx` (default 0), `selectedPathway` derived from index
- Inserted new Card section at the top of the page (between page header and KPI cards):
  - Gradient top bar (emerald → teal → cyan)
  - CardHeader with title "Interactive Degradation Pathway Map" + Network icon
  - shadcn `Select` dropdown listing all 5 predefined molecules with degradant count (e.g., "Aspirin (2 degradants)")
  - `DegradationPathway` component renders the selected pathway (keyed by molecule name so animations re-run on switch)
  - Footer note showing degradant count + condition count + "literature values" disclaimer
- All existing functionality preserved (KPI cards, charts, hazard filter pills, search, molecule filter, grouped cards, add product dialog)

### 4. `src/components/pages/MoleculesPage.tsx` — added pathway to Degradation tab

- Added imports: `Network` icon; `findPathwayForMolecule` helper; `DegradationPathway` component
- In the molecule detail dialog's "Degradation" tab, added an inline IIFE block above the existing product list:
  - Calls `findPathwayForMolecule(selectedMolecule.name)` to look up a predefined pathway
  - Builds `pathwayProducts` from API-fetched degradation products (preferred) — enriching each with `condition` matched from predefined pathway by product name — or falls back to predefined pathway products
  - Derives `pathwaySmiles` / `pathwayCas` / `pathwayFormula` from selected molecule OR predefined pathway
  - Shows a "Reference pathway" badge when falling back to predefined data (i.e., when no API products exist)
  - Renders `DegradationPathway` in `compact` mode inside an emerald-tinted bordered container
  - Loading state shows Skeleton placeholders
  - Returns `null` when no pathway data and not loading (so existing empty-state message remains visible)
- Preserved the existing detailed product list UI (with progress bars) and the "Add degradation product" form below the pathway map

## Verification

- **ESLint**: `bun run lint` → 0 errors, 0 warnings ✓
- **Dev server**: `GET /` → HTTP 200 ✓
- **API**: `GET /api/degradation-products` → HTTP 200 ✓
- No compile errors in `dev.log`
- Component is `'use client'` and uses dynamic import for smiles-drawer (already done in `MoleculeStructure`), so no SSR issues
- All SMILES strings verified as syntactically valid smiles-drawer input (canonical SMILES from PubChem/Wikipedia)
- Color scheme strictly uses emerald/teal/cyan/amber/red (NO indigo/blue) per project styling rule

## Architecture Notes

- The `DegradationPathway` component is a pure presentational component — no API calls, no global state. It just takes `moleculeName` + `smiles?` + `degradationProducts?` props and renders the tree.
- Layout uses a `ResizeObserver` to track container width and compute pixel-accurate SVG coordinates for the bus + drop arrows. This avoids the distortion that would occur with `preserveAspectRatio="none"` and lets the connector arrows line up perfectly with product card centers across all responsive breakpoints.
- The component handles 3 modes:
  1. **No products** → friendly empty state with floating circles animation
  2. **Single product** → single vertical drop (no bus line)
  3. **Multiple products** → tree with horizontal bus + N drops
- The `compact` prop renders a smaller variant suitable for narrow dialog containers (used by MoleculesPage detail dialog).
- The molecule selector on the Degradation page uses shadcn `Select` and is keyed by numeric index into `DEGRADATION_PATHWAYS`, which keeps the dropdown stateless and avoids name-collision issues if duplicate molecule names are added in the future.
- In MoleculesPage, the inline IIFE pattern keeps the pathway logic local to the Degradation tab without polluting the parent component's state or requiring a separate sub-component.
