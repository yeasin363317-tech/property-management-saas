# Design system
Tailwind with a `brand` blue (500 `#2563eb`, 600 `#1d4ed8`, 700 `#1e40af`), slate neutrals, system/Inter font stack. Components live in `src/components/ui.tsx`: Button (primary/secondary/danger/ghost, loading), Input/Select/Textarea, Field (label + hint + error with `role=alert`), Card, Modal (Escape, backdrop, focus first control, bottom-sheet on mobile), ConfirmDialog, Badge/statusTone, Table/Pager, Stat, Spinner, Empty, ErrorBox.
Rules: every input has a label; errors are text, not colour alone; destructive actions use ConfirmDialog or a reason dialog; every list has loading, empty and error states; tables scroll horizontally inside their own container; sidebar becomes a Menu toggle under 768px; focus ring is always visible.
Status colours: green = paid/active/completed, red = overdue/suspended/urgent, amber = partial/waiting/reserved, blue = open/new/in progress, grey = other.

## v1.1 update
Tokens live in `tailwind.config.js` (`brand` scale, `shadow-card|pop|hero`, Inter font stack). Logo: `src/components/Logo.tsx`; icons: `src/components/icons.tsx` (inline SVG, no new dependency). New shared pieces: `Skeleton`, `PermissionDenied`. Modal now traps Tab focus and restores focus on close. Minimum control height is 40px (44px on landing CTAs). `prefers-reduced-motion` is honoured in `src/index.css`.
