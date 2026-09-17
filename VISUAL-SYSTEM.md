# PureFile — Visual Experience & Motion System Guide

**Architecture:** PureFile Design System (Direction A — Clean Technical Studio)  
**Philosophy:** Purposeful, snappy, and tactile motion without gaming fluff, sluggish delays, or layout-triggering performance bottlenecks.

---

## 1. Motion Tokens & Easing Curves

All animation durations and timing functions are strictly centralized in `src/styles/global.css` and `tailwind.config.mjs`.

### Timing Tokens
| Token | Duration | Usage |
| :--- | :--- | :--- |
| `--motion-fast` | `140ms` | Micro-interactions: button presses, focus rings, tag badges, icon shifts |
| `--motion-normal` | `220ms` | Card hover elevations, modal backdrops, dropdown toggles, dropzone border changes |
| `--motion-slow` | `360ms` | Section entrances, scroll reveals, drawer slide transitions |

### Easing Curve Tokens
| Token | CSS Function | Character & Purpose |
| :--- | :--- | :--- |
| `--ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Responsive Deceleration:** High initial velocity with natural, smooth settling. Used for buttons, cards, and micro-interactions. |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | **Smooth Entrance:** Gentle arrival into the viewport. Used for scroll reveals and page entrances. |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | **Deliberate Exit:** Gradual acceleration away from the screen. Used for dismissals and exits. |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Subtle Elasticity:** Micro-spring response for checkmark reveals and drop confirmations. |

---

## 2. Visual Depth & Surface Hierarchy

PureFile uses a restrained, multi-layered depth system to create tactile hierarchy without noisy neon glows or heavy glassmorphism:

### Surface Palette
- `surface-50` (`#FAFAFA`): Base page background.
- `surface-100` (`#F4F4F5`): Inset containers, dropzone backgrounds, badge pills.
- `surface-200` (`#E4E4E7`): Standard structural borders and divider lines.
- `surface-300` (`#D4D4D8`): Interactive hover borders and input outlines.
- `surface-900` / `surface-950` (`#09090B`): Primary typography and contrast surfaces.

### Shadow & Elevation Levels
| Class / Variable | Elevation | Value |
| :--- | :--- | :--- |
| `shadow-2xs` | Level 0 | `0 1px 2px 0 rgba(0, 0, 0, 0.04)` |
| `shadow-xs` | Level 1 | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` |
| `shadow-sm` | Level 2 | `0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.05)` |
| `shadow-card-hover` | Level 3 (Interactive) | `0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04)` |
| `shadow-button-hover` | Accent Lift | `0 4px 14px -2px rgba(37, 99, 235, 0.28)` |
| `shadow-dropzone-active` | Active Target | `0 8px 30px rgba(37, 99, 235, 0.12)` |

### Atmospheric Ambient Depth
- A subtle radial gradient highlight is embedded in the hero section:
  ```html
  <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[300px] bg-gradient-to-b from-brand-500/8 via-indigo-500/4 to-transparent blur-3xl opacity-60 pointer-events-none"></div>
  ```
  This creates clean visual depth without adding any runtime JavaScript or canvas overhead.

---

## 3. Component Interaction States

Every interactive component supports a standardized 8-state model:

### 1. Buttons (`.btn-primary`, `.btn-secondary`, `.btn-ghost`)
- **Idle**: Crisp 1px border, flat or subtle shadow (`shadow-xs`).
- **Hover**: Subtle physical lift (`-translate-y-0.5`), illuminated shadow (`shadow-button-hover`), border saturation.
- **Active / Press**: Tactile compression (`scale-[0.985]`, `translate-y-0`).
- **Focus**: Distinct accessible 2px ring with 1px offset (`focus-visible:ring-brand-500/25`).
- **Disabled**: Dimmed opacity (`opacity-50`), `pointer-events-none`, cursor `not-allowed`.

### 2. Tool Directory Cards (`ToolCard.astro`)
- **Idle**: Zinc border (`border-surface-200/80`), `shadow-2xs`.
- **Hover**: 
  - Card translates upward by 2px (`-translate-y-1`).
  - Shadow expands to `shadow-card-hover`.
  - Icon subtly scales (`group-hover:scale-105`).
  - Right arrow shifts forward (`group-hover:translate-x-1.5`) via `.transition-transform`.
- **Focus**: Keyboard focus indicator (`ring-2 ring-brand-500`).

### 3. File Dropzone (`FileDropzone.astro`)
- **Idle**: Dashed border (`border-surface-300`), white surface, upload arrow centered.
- **Hover**: Dashed border turns cobalt (`border-brand-400`), background warms to `brand-50/15`, upload arrow rises 2px.
- **Drag-Active**: Scales up (`scale-[1.008]`), border turns solid cobalt (`border-brand-500`), ambient drop shadow (`shadow-dropzone-active`).
- **Accepted**: Smooth switch to green file badge with micro-spring entrance (`animate-entrance`).
- **Error**: Border flashes rose (`border-danger-400`) with clear diagnostic text.

### 4. Form Inputs & Selects (`.input-base`, `.select-base`)
- **Idle**: Border `surface-300`, background white.
- **Focus**: Smooth transition (`duration-fast`) to cobalt border (`border-brand-500`) and soft ring (`ring-2 ring-brand-500/20`).

---

## 4. Scroll Reveal & Entrance Engine

Scroll reveals are powered by a zero-dependency script (`src/scripts/motion.ts`):

### How it Works
1. Any section or card marked with `.reveal-on-scroll` starts with:
   ```css
   opacity: 0;
   transform: translateY(14px);
   transition: opacity var(--motion-slow) var(--ease-out), transform var(--motion-slow) var(--ease-out);
   ```
2. When the user scrolls the element into view (threshold 0.08, rootMargin `-30px`), the class `.is-revealed` is attached:
   ```css
   opacity: 1;
   transform: translateY(0);
   ```
3. **One-Shot Only**: The element is immediately unobserved once revealed. No repetitive transitions or scroll-jacking occur.
4. **Above-the-Fold Guard**: Elements whose top coordinate is already within or above the viewport on initial page load are marked `.is-revealed` immediately, preventing any blank flash or content jump.

---

## 5. Reduced-Motion & Accessibility Compliance

PureFile enforces strict WCAG 2.1 compliance for users who have requested reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .reveal-on-scroll {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
```

- When `prefers-reduced-motion: reduce` is active:
  - All scroll reveal animations are completely bypassed; content renders in its final resting position immediately.
  - Transforms and decorative hover translations are eliminated.
  - Color and border-color transitions remain subtle or instant for clear state feedback without motion sickness.

---

## 6. Performance Guarantees

1. **Composite-Only Properties**: Motion is strictly restricted to `transform` and `opacity`. No layout recalculations (`width`, `height`, `top`, `left`, `margin`, `padding`) are animated.
2. **Zero Runtime Animation Libraries**: No GSAP, no Framer Motion, no Lottie. Zero kilobytes added to initial page bundles.
3. **Hardware Acceleration**: `will-change: opacity, transform` is applied specifically to animating elements and discarded once revealed.
