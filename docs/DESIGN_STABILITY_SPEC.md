# Design Stability Spec

## Layout

- Container max width: `1280px`
- 12-column grid with `24px` gap
- 8px spacing scale

## Typography

- UI fallback stack:
  - Inter
  - SF Pro Text
  - Segoe UI
  - Roboto
  - Noto Sans
  - Helvetica Neue
  - Arial
  - sans-serif
- Line-height baseline: `1.5`

## Breakpoints

- 320: small mobile
- 480: mobile
- 768: tablet
- 1024: laptop
- 1280: desktop

## RTL

- Runtime dir switch:
  - `html[dir="rtl"] { direction: rtl; }`

## CLS control

- Reserve media dimensions
- Fixed skeleton heights
- Use `aspect-ratio` for previews
- Preload critical fonts

## Motion

- Hover: 120ms
- Press: 80ms
- Page fade: 200ms
- Respect `prefers-reduced-motion`

## Accessibility

- ARIA labels for controls and links
- Keyboard navigation
- Visible focus states
- Contrast ratio >= 4.5

