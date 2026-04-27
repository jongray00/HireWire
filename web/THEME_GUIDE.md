# SignalWire Theme System Guide

A complete dark/light mode implementation following **SignalWire Brand Guidelines v1.0**.

## 🎨 Overview

This theme system implements SignalWire's brand identity with automatic dark/light mode switching, persistent user preferences, and a comprehensive color palette.

### Key Features

- ✅ **Full Light & Dark Mode** - Based on SignalWire brand guidelines
- ✅ **Persistent Theme** - Saved to localStorage automatically
- ✅ **Smooth Transitions** - All color changes animated
- ✅ **SignalWire Colors** - Complete brand palette in Tailwind
- ✅ **Semantic Tokens** - Theme-aware CSS variables
- ✅ **Zero Config** - Works out of the box
- ✅ **TypeScript** - Full type safety

---

## 🚀 Quick Start

### 1. Import and Use Theme Toggle

```tsx
import { ThemeToggle, ThemeToggleCompact } from '~/app/components/ThemeToggle';

export function MyComponent() {
  return (
    <div>
      <ThemeToggle /> {/* Floating animated toggle */}
      <ThemeToggleCompact /> {/* Compact inline toggle */}
    </div>
  );
}
```

### 2. Use Theme Store

```tsx
import { useThemeStore } from '~/app/stores/theme';

export function MyComponent() {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setTheme('dark')}>Force Dark</button>
      <button onClick={() => setTheme('light')}>Force Light</button>
    </div>
  );
}
```

### 3. Use Theme-Aware Styles

```tsx
export function MyComponent() {
  return (
    <div className="bg-theme-primary text-theme-primary">
      <h1 className="text-sw-blue dark:text-sw-pink">
        Automatically switches: Blue in light, Pink in dark
      </h1>
      <button className="bg-sw-blue hover:bg-sw-deepSea dark:bg-sw-pink">
        Themed Button
      </button>
    </div>
  );
}
```

---

## 🎨 Color System

### Primary Brand Colors

Based on SignalWire Brand Guidelines - these follow the official spec where:
- **Blue** is primary in light mode
- **Pink** is primary in dark mode

| Color | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `sw-blue` | Primary accent | ✅ Primary | Secondary |
| `sw-pink` | Primary accent | Secondary | ✅ Primary |
| `sw-mist` | Backgrounds | ✅ Used | Not used |
| `sw-breeze` | Accents | ✅ Used | Used |
| `sw-deepSea` | Emphasis | ✅ Used | Not used |
| `sw-charcoal` | Text/Backgrounds | Text only | Background |

### Using SignalWire Colors

```tsx
// Tailwind classes
<div className="bg-sw-blue text-white">Blue background</div>
<div className="bg-sw-pink text-white">Pink background</div>
<div className="bg-sw-mist">Mist background</div>
<div className="border-2 border-sw-breeze">Breeze border</div>
<p className="text-sw-deepSea">Deep Sea text</p>
<p className="text-sw-charcoal">Charcoal text</p>

// Neutral grays
<div className="bg-sw-grey-2">Grey 2</div>
<div className="bg-sw-grey-4">Grey 4</div>
<div className="bg-sw-grey-6">Grey 6</div>
<div className="bg-sw-grey-8">Grey 8</div>

// Secondary colors (data indicators)
<span className="text-sw-green">Success</span>
<span className="text-sw-yellow">Warning</span>
<span className="text-sw-purple">Info</span>
<span className="text-sw-red">Error</span>
```

---

## 🔧 Semantic Theme Tokens

Use these for automatic light/dark switching:

### Background Tokens

```tsx
<div className="bg-theme-primary">   {/* White → Charcoal */}
<div className="bg-theme-secondary"> {/* Mist → Dark variant */}
<div className="bg-theme-tertiary">  {/* Grey 8 → Lighter variant */}
```

### Text Tokens

```tsx
<p className="text-theme-primary">   {/* Charcoal → White */}
<p className="text-theme-secondary"> {/* Grey 2 → Grey 6 */}
<p className="text-theme-tertiary">  {/* Grey 4 → Grey 4 */}
```

### Border Tokens

```tsx
<div className="border border-theme-border">      {/* Grey 6 → Dark */}
<div className="border-2 border-theme-border">
```

---

## 📐 CSS Variables

All theme colors are available as CSS variables in RGB format for maximum flexibility:

### Light Mode Variables
```css
--bg-primary: 255, 255, 255;      /* White */
--bg-secondary: 241, 248, 255;    /* Mist */
--bg-tertiary: 245, 247, 250;     /* Grey 8 */

--text-primary: 5, 9, 16;         /* Charcoal */
--text-secondary: 85, 96, 106;    /* Grey 2 */
--text-tertiary: 141, 150, 158;   /* Grey 4 */

--accent-primary: 4, 78, 244;     /* Blue */
--accent-secondary: 247, 42, 114; /* Pink */
```

### Dark Mode Variables
```css
--bg-primary: 5, 9, 16;           /* Charcoal */
--bg-secondary: 10, 15, 26;       /* Darker */
--bg-tertiary: 26, 31, 40;        /* Lighter */

--text-primary: 255, 255, 255;    /* White */
--text-secondary: 190, 195, 201;  /* Grey 6 */
--text-tertiary: 141, 150, 158;   /* Grey 4 */

--accent-primary: 247, 42, 114;   /* Pink */
--accent-secondary: 183, 217, 255;/* Breeze */
```

### Using CSS Variables

```css
/* In your CSS files */
.my-component {
  background-color: rgb(var(--bg-primary));
  color: rgb(var(--text-primary));
  border: 1px solid rgb(var(--border));
}

/* With alpha transparency */
.my-overlay {
  background-color: rgba(var(--bg-primary), 0.8);
}
```

---

## 🎯 Common Patterns

### Buttons

```tsx
// Primary button - follows brand guidelines
<button className="px-6 py-3 rounded-lg bg-sw-blue hover:bg-sw-deepSea dark:bg-sw-pink dark:hover:opacity-90 text-white font-medium transition-colors">
  Primary Action
</button>

// Secondary button
<button className="px-6 py-3 rounded-lg border-2 border-sw-blue dark:border-sw-pink text-sw-blue dark:text-sw-pink hover:bg-sw-blue hover:text-white dark:hover:bg-sw-pink transition-colors">
  Secondary Action
</button>

// Ghost button
<button className="px-6 py-3 rounded-lg text-sw-blue dark:text-sw-pink hover:bg-theme-secondary transition-colors">
  Ghost Action
</button>
```

### Cards

```tsx
<div className="p-6 rounded-lg bg-theme-secondary border border-theme-border hover:shadow-lg transition-shadow">
  <h3 className="text-xl font-heading font-bold text-theme-primary mb-2">
    Card Title
  </h3>
  <p className="text-theme-secondary">
    Card description text that adapts to theme.
  </p>
</div>
```

### Forms

```tsx
<input
  type="text"
  className="w-full px-4 py-3 rounded-lg border border-theme-border bg-theme-primary text-theme-primary focus:border-sw-blue dark:focus:border-sw-pink focus:ring-2 focus:ring-sw-blue/20 dark:focus:ring-sw-pink/20 transition-colors"
  placeholder="Enter text..."
/>

<select className="w-full px-4 py-3 rounded-lg border border-theme-border bg-theme-primary text-theme-primary focus:border-sw-blue dark:focus:border-sw-pink">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Navigation

```tsx
<nav className="border-b border-theme-border bg-theme-secondary">
  <div className="flex items-center justify-between px-6 py-4">
    <h1 className="text-2xl font-heading font-bold text-sw-blue dark:text-sw-pink">
      SignalWire
    </h1>
    <div className="flex items-center gap-4">
      <a href="#" className="text-theme-secondary hover:text-theme-primary">
        Features
      </a>
      <a href="#" className="text-theme-secondary hover:text-theme-primary">
        Pricing
      </a>
      <ThemeToggleCompact />
    </div>
  </div>
</nav>
```

### Status Indicators

```tsx
// Success
<div className="flex items-center gap-2 text-sw-green">
  <CheckIcon />
  <span>Connected</span>
</div>

// Warning
<div className="flex items-center gap-2 text-sw-yellow">
  <AlertIcon />
  <span>Reconnecting...</span>
</div>

// Error
<div className="flex items-center gap-2 text-sw-red">
  <ErrorIcon />
  <span>Disconnected</span>
</div>

// Info
<div className="flex items-center gap-2 text-sw-purple">
  <InfoIcon />
  <span>Processing</span>
</div>
```

---

## 🎭 Typography

The theme uses SignalWire's official typefaces:

### Headings
**Font:** Neue Einstellung Bold
**Fallback:** Arial

```tsx
<h1 className="text-4xl font-heading font-bold text-theme-primary">
  Primary Headline
</h1>
<h2 className="text-2xl font-heading font-bold text-theme-primary">
  Section Heading
</h2>
```

### Body Text
**Font:** Inter Regular
**Fallback:** sans-serif

```tsx
<p className="text-base text-theme-primary">
  Primary body copy for main content.
</p>
<p className="text-sm text-theme-secondary">
  Secondary text for captions and helpers.
</p>
```

---

## 🧩 Architecture

### File Structure

```
web/src/app/
├── stores/
│   └── theme.ts              # Zustand store for theme state
├── components/
│   ├── ThemeProvider.tsx     # Theme provider component
│   ├── ThemeToggle.tsx       # Toggle button components
│   └── ThemeDemo.tsx         # Demo/showcase component
├── global.css                # Theme CSS variables
└── root.tsx                  # App root with ThemeProvider
```

### How It Works

1. **Theme Store** (`stores/theme.ts`)
   - Zustand store with persist middleware
   - Stores theme preference in localStorage
   - Provides `theme`, `setTheme()`, and `toggleTheme()`

2. **Theme Provider** (`components/ThemeProvider.tsx`)
   - Syncs store state with DOM
   - Adds `.light` or `.dark` class to `<html>`
   - Sets `data-theme` attribute

3. **CSS Variables** (`global.css`)
   - Defines color tokens for both modes
   - Uses RGB format for alpha transparency support
   - Applies transitions for smooth theme changes

4. **Tailwind Config** (`tailwind.config.js`)
   - Adds SignalWire brand colors
   - Creates semantic theme utilities
   - Enables `darkMode: 'class'`

---

## 🎪 Demo Component

See a live example of all theme features:

```tsx
import { ThemeDemo } from '~/app/components/ThemeDemo';

export default function DemoPage() {
  return <ThemeDemo />;
}
```

The demo showcases:
- ✅ All SignalWire brand colors
- ✅ Theme toggle buttons
- ✅ Typography samples
- ✅ Interactive elements
- ✅ Status indicators
- ✅ Form components
- ✅ Brand identity values

---

## 🔥 Best Practices

### ✅ DO

- Use semantic tokens (`bg-theme-primary`) for elements that should adapt to theme
- Use brand colors (`bg-sw-blue`) for elements with fixed colors
- Follow the guideline: Blue primary in light, Pink primary in dark
- Test both themes during development
- Use `transition-colors` for smooth theme changes

### ❌ DON'T

- Don't use raw hex colors in className strings
- Don't mix theme semantics (e.g., don't use `bg-sw-blue` on cards that should adapt)
- Don't forget to add dark mode variants for custom colors
- Don't override theme colors with `!important` unless absolutely necessary

---

## 📚 Additional Resources

- [SignalWire Brand Guidelines v1.0](../SIGNALWIRE_BRAND_GUIDELINES.md)
- [Tailwind Dark Mode Docs](https://tailwindcss.com/docs/dark-mode)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

---

## 🤝 Contributing

When adding new components:

1. Use semantic tokens for adaptive colors
2. Add `dark:` variants where needed
3. Test in both light and dark modes
4. Follow SignalWire brand guidelines
5. Add `transition-colors` for smooth changes

---

## 📝 License

This theme system follows the SignalWire Brand Guidelines v1.0.
