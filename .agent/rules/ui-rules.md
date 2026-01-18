---
trigger: always_on
---

# Opus UI/UX Design System

> **Context:** This document complements the **Project Architecture Rules**. While the Architecture Rules dictate *code structure* (CVA, Directory), this document dictates the *visual outcome* and *aesthetic choices*.

## 1. Visual Identity: "The Dichotomy"

We maintain two distinct emotional states sharing one skeleton.

* **Light Mode ("Clean Slate")**:
* **Vibe:** Tangible, Paper-like, High Focus.
* **Key Traits:** Crisp borders, subtle shadows, high contrast text.


* **Dark Mode ("Deep Space")**:
* **Vibe:** Ethereal, Glassy, Immersive.
* **Key Traits:** `backdrop-blur`, glowing borders, muted backgrounds, "starlight" accents.



---

## 2. Token Mapping (Strict Semantics)

**RULE:** Never use hex codes or raw Tailwind colors (e.g., `slate-50`) in components. Use the Semantic Tokens defined in `globals.css`.

| Semantic Token | Visual Intent (Light) | Visual Intent (Dark) |
| --- | --- | --- |
| `bg-background` | **Paper White** (`#ffffff` / `slate-50`) | **Void Black** (`#020617` / `slate-950`) |
| `bg-card` | **White Card** + Shadow | **Glass Layer** (`white/5` + Blur) |
| `text-foreground` | **Ink Black** (`slate-900`) | **Starlight White** (`slate-50`) |
| `text-muted-foreground` | **Pencil Grey** (`slate-500`) | **Nebula Grey** (`slate-400`) |
| `border-border` | **Solid Line** (`slate-200`) | **Ghost Line** (`white/10`) |
| `bg-primary` | **Electric Indigo** (Solid) | **Electric Indigo** (Glow) |

---

## 3. Core CVA Patterns

*Refencing the Architecture Rule 4.B: All standard UI patterns must be encapsulated in CVA.*

### A. The "Universal Card" (Surface)

Used for vocabulary cards, article previews, and stats containers.

```tsx
// Visual Definition
const cardVariants = cva(
  "relative overflow-hidden rounded-xl border transition-all duration-300", 
  {
    variants: {
      intent: {
        // Light: Tangible / Dark: Glassy
        default: "bg-card text-card-foreground border-border shadow-sm hover:shadow-md dark:backdrop-blur-md dark:hover:border-primary/30",
        // For highlighted content
        glow: "border-primary/50 bg-primary/5 dark:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
      },
      interaction: {
        none: "",
        hover: "hover:-translate-y-1 cursor-pointer", // The "Lift" effect
      }
    },
    defaultVariants: {
      intent: "default",
      interaction: "none",
    }
  }
)

```

### B. The "Glass Header" (Navigation)

Headers must float above content.

```tsx
// Visual Definition
const headerVariants = cva(
  "sticky top-0 z-50 border-b w-full supports-[backdrop-filter]:bg-background/60 backdrop-blur-xl",
  {
    variants: {
      variant: {
        default: "border-border",
        transparent: "border-transparent bg-transparent", // For Hero sections
      }
    }
  }
)

```

---

## 4. Typography & Hierarchy

Use strict Tailwind utility mappings to ensure rhythm.

* **H1 (Page Title):** `text-3xl md:text-4xl font-bold tracking-tight text-foreground`
* **H2 (Section Header):** `text-xl md:text-2xl font-semibold tracking-tight text-foreground`
* **Body:** `text-sm md:text-base leading-relaxed text-muted-foreground`
* **Micro/Meta:** `text-xs font-medium uppercase tracking-wider text-muted-foreground/70`

---

## 5. Animation & Motion (Aceternity Integration)

### A. Standard Micro-Interactions

* **Transition:** Always use `transition-all duration-300 ease-out` for UI state changes.
* **Active:** Buttons should have `active:scale-95`.

### B. High-Impact Effects (Aceternity UI)

Use **Aceternity UI** components sparingly for specific "Wow" moments.

* **Hero Sections:** Use `BackgroundBeams` or `Spotlight` to create depth in Dark Mode.
* **Feature Cards:** Use `BentoGrid` or `MovingBorder` for key feature highlighting.
* **Text:** Use `TextGenerateEffect` for AI output streaming simulation.

*Constraint:* Do not overuse expensive animations on layout-heavy pages (like Dashboards).

---

## 6. Iconography Strategy

*Refencing Architecture Rule 4.B.4*

* **Source:** **Lucide React** Only.
* **Stroke:** `stroke-[1.5px]` (Elegant/Thin) for UI, `stroke-2` for small actions.
* **Color:** Inherit via `currentColor` or explicitly use `text-muted-foreground`.
* **Visual Test:** If an icon looks "heavy" compared to the text, reduce stroke width or size.

---

## 7. Quality Assurance Checklist (Visual)

Before approving a UI component:

1. [ ] **Dark Mode Check:** Does the card look like "Frosted Glass" (borders visible, bg translucent) in dark mode?
2. [ ] **Token Check:** Are you using `bg-slate-50` (Forbidden) or `bg-background` (Correct)?
3. [ ] **Mobile Check:** Is the text legible on mobile (minimum `text-base` for inputs)?
4. [ ] **Empty States:** Do lists have a visually pleasing "Empty State" (using muted icons)?