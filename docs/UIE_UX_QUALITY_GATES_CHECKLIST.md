# UIE UX Quality Gates Checklist

Date: 2026-02-14  
Scope: Cross-cutting UX hardening for UIE state handling, accessibility, motion, and responsive QA.

## 1. State Coverage

- [x] Origin state: landing flow supports explicit geolocation intent, search-first flow, permission-denied messaging, and loading states.
- [x] Results state: ranked list surfaces loading, empty, and fallback/error status messages with live updates.
- [x] Enrichment state: transit enrichment partial/unavailable scenarios surface user-visible notices instead of silent console-only behavior.
- [x] Map state: map shell has clear loading/configuration/error fallback cards.

## 2. Accessibility

- [x] Card interaction is keyboard-accessible (native button semantics).
- [x] Active card state is announced via `aria-pressed`.
- [x] Card controls expose descriptive `aria-label` + `aria-describedby` trip context.
- [x] Focused map toggle is keyboard-accessible and ARIA-labeled (`aria-pressed`, `aria-controls`).
- [x] Results status updates use `aria-live="polite"` for screen-reader announcements.
- [x] Collapsible summary uses semantic `<details>/<summary>` disclosure behavior.

## 3. Motion & Interaction Comfort

- [x] Reduced-motion preference is respected for animated transitions.
- [x] Focused-map scroll behavior falls back to non-smooth movement when reduced motion is enabled.

## 4. Performance & Regression Gates

- [x] Single active map surface architecture retained (no per-card map mounts).
- [x] Build/lint gates pass (`npm run lint`, `npm run build`).
- [x] Responsive breakpoints retained and validated in styles for stacked mobile layout and multi-column card grid.

## 5. Manual QA Runbook (Desktop + Mobile)

- [x] Desktop (>=1120px): verify 3-column cards, focused map toggle, map marker updates on card selection.
- [x] Tablet (~760px): verify 2-column preferences layout and stable stacked section order.
- [x] Mobile (<=560px): verify list/map headers stack without overlap and controls remain reachable.
- [x] Origin denial path: deny geolocation and confirm search-only flow remains fully usable.
- [x] Fallback path: disable live keys and confirm mock results + state messaging render cleanly.
