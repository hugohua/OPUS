# Opus UI/UX Design System (v1.6 Master)

> **LLM Instruction:** You act as the Lead Frontend Engineer. This document is the **Single Source of Truth** for visual implementation.
> 1. **Strict Adherence:** Do not invent new colors. Use the tokens below.
> 2. **CVA First:** All interactive components must be defined using `class-variance-authority`.
> 3. **Mobile First:** All layouts default to mobile view (`w-full`), using `md:` for desktop overrides.
> 
> 

## 1. Visual Identity: "The Dichotomy"

We maintain two distinct emotional states sharing one skeleton.

### Light Mode ("Clean Slate")

* **Concept:** A fresh sheet of high-quality paper.
* **Traits:** `bg-zinc-50`, `shadow-sm`, crisp borders (`border-zinc-200`), high contrast text.
* **Feel:** Clinical, Precise, Tangible.

### Dark Mode ("Deep Space") - *CRITICAL UPDATE*

* **Concept:** A futuristic HUD in a cockpit.
* **Traits:**
* **Background:** NEVER use solid black. MUST use `bg-zinc-950` with a top ambient glow:
`<div class="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none"></div>`
* **Cards:** Use **Glassmorphism** with Inner Highlight for depth.
`bg-zinc-900/60 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]`


* **Feel:** Immersive, Fluid, "Gamer-Professional".

---

## 2. Token Mapping (Strict Semantics)

**RULE:** Never use raw colors (e.g., `red-500`). Use semantic names to ensure mode compatibility.

### A. Base Surfaces

| Semantic Token | Tailwind Class (Light) | Tailwind Class (Dark) |
| --- | --- | --- |
| `bg-background` | `bg-zinc-50` | `bg-zinc-950` |
| `bg-surface` | `bg-white` | `bg-zinc-900/60` |
| `border-base` | `border-zinc-200` | `border-white/15` |
| `text-primary` | `text-zinc-900` | `text-zinc-50` (Pure White) |
| `text-secondary` | `text-zinc-500` | `text-zinc-400` (Legible Grey) |

### B. Brand & Status (Opus v1.6 Specific)

| Semantic Token | Tailwind Class (Light/Dark) | Context |
| --- | --- | --- |
| `brand-core` | `violet-600` / `violet-500` | **Actions ONLY** (Buttons, Active State) |
| `status-ready` | `emerald-600` / `emerald-400` | Syntax Mode, Success, Mastered |
| `status-warn` | `amber-500` / `amber-500` | **Backlog Warning** (Border/Badge) |
| `status-lock` | `zinc-400` / `zinc-600` | Locked Levels |

### C. Text Color Hierarchy (Anti-Noise Rule) - *NEW*

**RULE:** Text conveys information; Color conveys state.

* ✅ **Headers/Titles:** MUST be Neutral (`text-zinc-900` / `text-zinc-100`).
* ✅ **Body Text:** MUST be Neutral (`text-zinc-500` / `text-zinc-400`).
* ⚠️ **Brand Color (`text-violet-600`):** Use **ONLY** for:
1. Interactive Buttons / Links.
2. "NEW" / "Beta" Badges.
3. Active Icons.
4. *Inline Emphasis* within a neutral paragraph.


* 🚫 **Forbidden:** Do NOT colorize entire card titles in Violet.

### D. Syntax Highlighting (The "S-V-O" System)

*Used strictly for Syntax Mode Drills.*
| Logic | Color Tone |
| :--- | :--- |
| **Subject (S)** | **Sage Green** (`text-emerald-700` / `text-emerald-300`) |
| **Verb (V)** | **Warm Coral** (`text-rose-600` / `text-rose-400`) |
| **Object (O)** | **Ocean Blue** (`text-sky-600` / `text-sky-300`) |

---

## 3. Typography & Hierarchy

**Font Stack:**

* **Sans (UI):** `Inter` or `SF Pro` (System).
* **Mono (Data):** `JetBrains Mono` or `Geist Mono`. **Mandatory** for:
* Syntax Mode sentences.
* Phrase X-Ray views.
* Stats / Batch Sizes.


* **Serif (Reader):** `Merriweather` or `Playfair Display`. **Mandatory** for:
* Context Engine Article Previews (to simulate "Reader Mode").



**Scale:**

* **H1 (Page):** `text-2xl font-bold tracking-tight text-primary`
* **H2 (Section):** `text-sm font-semibold tracking-wider uppercase text-primary`
* **Body:** `text-sm leading-relaxed text-secondary`

---

## 4. Core CVA Patterns (Component Architecture)

### A. The "Universal Card" (Smart Surface)

*Updated with Dark Mode Fixes (Inner Highlight)*

```tsx
const cardVariants = cva(
  "relative w-full overflow-hidden rounded-2xl border transition-all duration-300 ease-out", 
  {
    variants: {
      intent: {
        // Light: Paper / Dark: Glass with Highlight
        default: "bg-white border-zinc-200 shadow-sm dark:bg-zinc-900/60 dark:border-white/15 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl",
      },
      status: {
        neutral: "", 
        // 🟢 Ready: Green hint
        healthy: "dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)] border-emerald-500/20",
        // 🟠 Backlog: Amber border + Glow
        warning: "border-amber-500/30 dark:shadow-[0_0_30px_-10px_rgba(245,158,11,0.2)]",
        // 🔒 Locked: Dimmed
        locked: "opacity-60 grayscale cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50",
      },
      interaction: {
        none: "",
        pressable: "active:scale-[0.98] active:opacity-90 cursor-pointer", 
      }
    },
    defaultVariants: {
      intent: "default",
      status: "neutral",
      interaction: "none",
    }
  }
)

```

### B. The "Thumb Button" (Primary Action)

*Designed for 'Magic Paste'.*

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/25 border-0",
        ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      },
      size: {
        default: "h-10 px-4",
        // Mobile Thumb Target (Floating)
        "floating-action": "h-16 w-16 -top-8 absolute shadow-xl border-4 border-zinc-50 dark:border-zinc-950", 
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

```

---

## 5. Mobile-First Interaction Rules

1. **Touch Targets:**
* All interactive elements must be at least `min-h-[44px]`.


2. **Thumb Zone:**
* Primary Actions (Magic Paste) must reside in the bottom 30% of the viewport.
* **Safe Area:** Always add `pb-32` to the main container to ensure content isn't hidden behind the floating dock.


3. **Context-Aware Nav:**
* The Floating Dock should be visible on Dashboard but **hidden** during immersive Drill Sessions.



---

## 6. Iconography Strategy (Strict Consistency)

**Library:** **Lucide React**.
**Style:** `stroke-width={1.5}` (Thin).

| Concept | Icon Name (Lucide) | Rationale |
| --- | --- | --- |
| **Syntax Mode** | `<Wrench />` | Fixing mechanics. |
| **Chunking Mode** | `<Link />` | Connecting flow. |
| **Nuance Mode** | `<Target />` | Precision. |
| **Context Engine** | `<Plane>`, `<Handshake>` | Business Scenarios. |
| **Magic Paste** | `<Sparkles />` | AI generation. |
| **Backlog** | `<ClockAlert />` | Warning/Debt. |

---

## 7. Kinetic Interaction & Motion (Framer Motion)

**Philosophy:** "Physical fluid, not a slideshow."

* **Physics:** Use `type: "spring", stiffness: 400, damping: 30`.
* **Micro-Interaction:** All buttons must use `whileTap={{ scale: 0.95 }}`.
* **Loading State:** Use "Typewriter Cursor" (`animate-pulse bg-violet-500`) for AI text generation.

---

## 8. QA Checklist for Generated Code

Before outputting code, verify:

1. [ ] **Dark Mode:** Is the ambient light gradient present? Are borders visible (`border-white/15`)?
2. [ ] **Anti-Noise:** Are Card Titles neutral (Black/White), NOT Violet?
3. [ ] **Backlog:** Is the "Warning" state implemented using `amber` border and badge?
4. [ ] **Thumb Zone:** Is the Magic Paste button `h-16` and floating?
5. [ ] **Typography:** Is `font-serif` used for the Article Preview text?