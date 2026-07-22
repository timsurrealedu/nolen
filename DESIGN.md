# Nolen Design System

## Direction

An incident room at first light: quiet white working surfaces, charcoal evidence text, and a disciplined living-green signal for active navigation and confirmed actions. Restrained color; severity colors carry meaning only beside text labels.

## Tokens

```css
:root {
  --bg: oklch(1 0 0);
  --surface: oklch(0.965 0.004 150);
  --ink: oklch(0.19 0.018 150);
  --muted: oklch(0.47 0.018 150);
  --primary: oklch(0.53 0.145 150);
  --accent: oklch(0.38 0.13 245);
  --danger: oklch(0.52 0.19 25);
  --warning: oklch(0.68 0.15 75);
  --success: oklch(0.49 0.13 150);
}
```

## Typography

Use the system sans stack for controls and prose, and the system monospace stack only for event IDs, timestamps, IPs, paths, and raw NEF. Keep product headings on a fixed compact scale.

## Layout and Components

Use a persistent navigation rail on wide screens and a compact top navigation on narrow screens. Prefer evidence tables, timelines, and split detail panes over repeated cards. Controls use 8–12px radii, visible focus rings, explicit labels, and 150–200ms state transitions with a reduced-motion fallback.
