---
name: Clinical Integrity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#00685f'
  on-tertiary: '#ffffff'
  tertiary-container: '#008378'
  on-tertiary-container: '#f4fffc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an authoritative, highly regulated digital environment bridging behavioral healthcare operations and legal oversight. The visual posture communicates uncompromised confidentiality, precision, and forensic accountability, while maintaining clinical empathy for client-patients navigating judicial or therapeutic mandates.

The aesthetic framework synthesizes **Corporate Modernism** with **Subtle Frosted Glassmorphism**:
- Structural layouts feature disciplined geometry, high-contrast typography, and strict functional partitioning.
- Surface treatments leverage crisp, semi-translucent frosted glass cards over deep slate and neutral backgrounds to convey institutional transparency without introducing distracting visual novelties.
- The tone avoids both sterile bureaucratic rigidity and consumer-app levity, grounding all interactions in an ethos of HIPAA-aligned security, evidentiary rigor, and therapeutic support.

## Colors

The color architecture is built to ensure unambiguous status signaling, strict WCAG AAA readability, and an unmistakable division between institutional authority and active clinical care.

### Primary (`#059669` — Medical Emerald / Trusted Mint)
The active operative accent. Applied to high-priority calls to action, active tracking statuses, successful compliance metrics, and primary affirmative interactions. It serves as the visual signature of progress, health, and verified compliance.

### Secondary (`#0F172A` — Deep Slate Navy)
The structural anchor. Represents legal authority, solemnity, and system reliability. Utilized for core navigation sidebars, major headlines, system headers, and authoritative metrics. It provides an institutional counterpart to the clinical emerald.

### Tertiary (`#0D9488` — Calm Clinical Teal)
The auxiliary monitoring accent. Deployed across secondary progress indicators, legal case linkage tags, secondary data series, and auxiliary interactive nodes.

### Neutral (`#64748B` — Architectural Slate)
A calibrated cool neutral spectrum. Provides structural framing lines, descriptive metadata labels, subtle divider lines, and card borders. 

### Operational & Surface Tones
- **Canvas Base:** `#F8FAFC` (Clean cold-white base)
- **Glass Panel Surface:** `rgba(255, 255, 255, 0.78)` with balanced backdrop filters
- **Critical Violation / Alert:** `#DC2626`
- **Warning / Review Required:** `#D97706`
- **Text Primary:** `#0F172A`
- **Text Secondary:** `#475569`

## Typography

The typographic hierarchy utilizes two synergistic typefaces configured to separate structural authority from data density:

- **Display & Headings (Plus Jakarta Sans):** Selected for its contemporary geometry and confident presence. The structural geometry ensures section headers, client names, and legal docket indicators stand distinct and legible at a glance.
- **Body & Data Displays (Inter):** Deployed for all informational copy, input values, tabulated reports, timestamps, and compliance audit notes. Inter’s vertical metrics, robust horizontal spacing, and neutral tall x-height maximize reading efficiency and scanability across complex monitoring dashboards.

### Editorial Guidelines
- Use uppercase styling exclusively for `label-sm` when designating status badges, verification states, and court-mandated milestones (e.g., `COMPLIANT`, `PENDING REVIEW`).
- Tabular data values and forensic timestamps must always render with standard tabular figures (`tnum`) to maintain vertical column alignment.

## Layout & Spacing

The layout runs on a responsive 12-column grid system designed to support complex legal-clinical dashboards, simultaneous client metrics, and audit log side-panels.

### Breakpoints & Canvas Logic
- **Desktop (1280px+):** 12-column fluid grid, `2rem` outer margins, `1.5rem` gutters. Accommodates dual fixed-width utilities (persistent clinical-attorney navigation sidebar at 260px; right-hand case file summary panel at 340px) surrounding a flexible monitoring core.
- **Tablet (768px – 1279px):** 8-column layout with `1.5rem` outer margins and `1rem` gutters. Navigation collapses to a slim icon-state dock or off-canvas overlay.
- **Mobile (< 768px):** 4-column layout with `1rem` margins and `1rem` gutters. Multi-column compliance cards stack vertically into a singular linear review stream.

### Rhythmic Rules
- Spacing between adjacent elements within a glass panel must not drop below `space-sm` (`0.5rem`).
- All interactive controls (buttons, form inputs, segmented switchers) align strictly to an 8px modular baseline to maintain clinical precision.

## Elevation & Depth

Visual hierarchy is delivered via **Frosted Glassmorphic Stratification** balanced by ultra-clean ambient occlusion. The goal is pristine, tactile clarity rather than heavy skeuomorphism.

### The Glass Layering Standard
1. **Base Slate Ground (`z-index: 0`):** `#F8FAFC` base with faint geometric ambient gradients (`#0F172A` at 3% opacity blending into `#0D9488` at 3% opacity) to provide depth behind translucent surfaces.
2. **Structural Panels & Dashboard Shells (`z-index: 10`):**
   - Background: `rgba(255, 255, 255, 0.72)`
   - Backdrop Blur: `12px`
   - Border: `1px solid rgba(226, 232, 240, 0.8)`
   - Ambient Shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.04)`
3. **Elevated Frosted Cards (`z-index: 20`):**
   - Background: `rgba(255, 255, 255, 0.88)`
   - Backdrop Blur: `16px`
   - Border: `1px solid rgba(255, 255, 255, 0.95)` with subtle drop shadow
   - Shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`
4. **Modals, Overlays & Audit Drawers (`z-index: 50`):**
   - Background: `rgba(255, 255, 255, 0.96)`
   - Backdrop Blur: `24px`
   - Scrim: `rgba(15, 23, 42, 0.45)` with `4px` blur
   - Shadow: `0 25px 50px -12px rgba(15, 23, 42, 0.25)`

### Outlines & Highlights
Cards and modular tiles utilize a soft top highlight: an inner border highlight of `inset 0 1px 0 0 rgba(255, 255, 255, 0.8)` providing crisp architectural separation against any ambient background tone.

## Shapes

The geometric language is set to `2` (Rounded). This provides a modern, approachable clinical environment without sacrificing structural discipline.

- **Primary Interactive Elements (Buttons, Inputs, Selectors):** Radius `0.5rem` (`8px`).
- **Cards, Panels & Data Containers:** Radius `1rem` (`16px`).
- **System Modals, Floating Flyouts & Case Drawers:** Radius `1.5rem` (`24px`).
- **Badges, Status Indicators & Avatars:** Pill radius (`9999px`) to immediately distinguish informational status markers from interactive containers.

## Components

### Buttons
- **Primary CTA (Mint / Medical Emerald):** Background `#059669`, text `#FFFFFF`, font-weight `600`, radius `0.5rem`. Subtle hover transition to `#047857` with an ambient glow shadow: `0 4px 14px rgba(5, 150, 105, 0.3)`. Focus state: `2px solid #FFFFFF`, `2px solid #059669`.
- **Secondary (Navy Authority):** Background `#0F172A`, text `#FFFFFF`, hover `#1E293B`. Used for exporting legal records, court filings, and system-level actions.
- **Tertiary / Subtle Glass:** Background `rgba(241, 245, 249, 0.6)`, border `1px solid rgba(203, 213, 225, 0.6)`, text `#0F172A`. Hover background `rgba(226, 232, 240, 0.8)`.

### Form Fields & Inputs
- **Base Style:** Background `rgba(255, 255, 255, 0.9)`, border `1.5px solid #CBD5E1`, text `#0F172A`, radius `0.5rem`.
- **Focus State:** Border `#059669`, ring `3px rgba(5, 150, 105, 0.15)`. Background shifts to pure `#FFFFFF`.
- **Labels:** Rendered in `Inter` `label-md` (`#334155`), with mandatory field indicators marked in `#DC2626`.
- **Accessibility Safeguard:** Inputs maintain an internal padding of `0.75rem 1rem` (minimum 44px touch target) with contrast ratios exceeding 4.5:1 against text and backgrounds.

### Status Chips & Badges
- **Compliant / Verified:** Background `rgba(16, 185, 129, 0.12)`, text `#047857`, border `1px solid rgba(16, 185, 129, 0.25)`.
- **Legal Review / Flagged:** Background `rgba(217, 119, 6, 0.12)`, text `#B45309`, border `1px solid rgba(217, 119, 6, 0.25)`.
- **Violation / Non-Compliant:** Background `rgba(220, 38, 38, 0.12)`, text `#B91C1C`, border `1px solid rgba(220, 38, 38, 0.25)`.
- All badges are rendered pill-shaped (`9999px`) with `label-sm` tracking.

### Cards & Monitoring Tiles
- Constructed using elevated frosted glass panels (`rgba(255, 255, 255, 0.85)` + backdrop blur `16px`).
- Internal sectioning is maintained using delicate divider lines (`1px solid rgba(226, 232, 240, 0.6)`) rather than heavy nested boxes.
- Metric highlights display numbers in `Plus Jakarta Sans` `headline-lg` paired with a micro `label-sm` uppercase descriptor.

### Data Tables & Case Logs
- **Header:** Sticky `#F8FAFC` background with subtle blur, text `#475569`, border-bottom `2px solid #E2E8F0`.
- **Row Interaction:** Hover state shifts to `rgba(241, 245, 249, 0.7)`. Alternating row zebra striping is avoided in favor of clean 1px borders (`#F1F5F9`).
- **HIPAA Masking Component:** Case IDs, SSNs, and clinical notes support a toggleable blur/reveal state with dedicated unmask logging.

### Specialized Components
- **Compliance Gauge:** Semi-circular or linear progress bar featuring a gradient track from `#0D9488` to `#059669` against a neutral `#E2E8F0` path.
- **Attorney Verification Seal:** A secure signature banner combining a deep slate background `#0F172A`, gold/emerald verification stamp, and mono-spaced cryptographic hash indicators.