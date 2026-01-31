# Theme System Documentation

This project uses a dynamic, customizable theming system built on top of **Tailwind CSS** , **CSS Variables** , and **OKLCH color space** . It is designed to be fully compatible with Shadcn UI components while allowing real-time customization via the Theme Editor.

## 1. Core Concepts

### Color Format (OKLCH)

We use the **OKLCH** color space for all theme colors. This allows for:

- Consistent perceptual brightness.
- Better gradients and color mixing.
- Dynamic manipulation (lightness/saturation adjustments) in the editor.

**Format:** `oklch(lightness chroma hue)`

_Example:_ `oklch(0.205 0 0)` (Dark Gray/Black)

### CSS Variables

The theme is driven by CSS variables defined in your code and injected into the DOM. These map directly to Tailwind utility classes.

| **Tailwind Class**        | **CSS Variable**       | **Description**                         |
| ------------------------- | ---------------------- | --------------------------------------- |
| `bg-background`           | `--background`         | Page background color                   |
| `text-foreground`         | `--foreground`         | Default text color                      |
| `bg-card`                 | `--card`               | Background for cards/containers         |
| `bg-primary`              | `--primary`            | Main brand color                        |
| `text-primary-foreground` | `--primary-foreground` | Text color on top of primary elements   |
| `bg-secondary`            | `--secondary`          | Secondary background color              |
| `bg-muted`                | `--muted`              | Muted backgrounds (e.g., table headers) |
| `bg-accent`               | `--accent`             | Hover effects and accent details        |
| `bg-destructive`          | `--destructive`        | Error/Delete actions                    |
| `border-border`           | `--border`             | Borders and dividers                    |
| `ring-ring`               | `--ring`               | Focus rings                             |

## 2. Using the Theme in Components

### Standard Usage (Tailwind)

Use the standard Shadcn/Tailwind utility classes. These automatically adapt to the current theme (light/dark) and any active customizations.

**TypeScript**

```
export function MyComponent() {
  return (
    <div className="bg-card text-card-foreground border-border rounded-xl border p-6">
      <h1 className="text-primary text-2xl font-bold">Hello World</h1>
      <p className="text-muted-foreground">This uses theme variables.</p>

      <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2">
        Click Me
      </button>
    </div>
  );
}
```

### Using Arbitrary Values (Inline Styles)

If you need to use a theme variable in a non-Tailwind property (e.g., complex SVGs or 3rd party libraries), use standard CSS variable syntax.

**TypeScript**

```
<div style={{ backgroundColor: 'var(--primary)' }}>
  Custom Content
</div>
```

### Charts (Recharts)

Our chart configuration automatically maps theme colors to chart segments.

**TypeScript**

```
// src/components/ui/chart.tsx maps these automatically
const chartData = [
  { browser: "chrome", visitors: 275, fill: "var(--color-chrome)" },
]

const chartConfig = {
  chrome: {
    label: "Chrome",
    color: "var(--chart-1)", // Maps to the first theme chart color
  },
}
```

## 3. Customizing the Default Theme

The default values for "Light" and "Dark" modes are stored in a configuration file.

**File:** `src/config/theme.ts`

To change the _initial_ look of your app before the user customizes it:

1. Open `src/config/theme.ts`.
2. Modify the `defaultLightThemeStyles` or `defaultDarkThemeStyles` objects.
3. Ensure you use the **OKLCH** string format.

**TypeScript**

```
// src/config/theme.ts
export const defaultLightThemeStyles = {
  // Change primary color to blue
  primary: "oklch(0.623 0.214 259.815)",
  "primary-foreground": "oklch(1 0 0)",
  // ...
};
```

## 4. How the Theme Engine Works

1. **Storage:** The user's custom theme preference is stored in `localStorage` via the `editor-store` (Zustand).
2. **Injection:** The `ThemeWrapper` or `ThemeProvider` component reads this state.
3. **Application:** It generates a CSS string containing all the variables (e.g., `--primary: oklch(...)`) and injects it into the `style` attribute of the root element or a specific wrapper.

### Updating Fonts

Fonts are handled similarly but injected as font-family strings.

1. **Google Fonts:** The app automatically fetches Google Fonts based on the current selection in the Editor.
2. **Classes:**
   - `font-sans`: Applied to the body by default.
   - `font-serif`
   - `font-mono`

## 5. Troubleshooting

**"The specified value does not conform to the required format"**

- **Cause:** Passing an `oklch(...)` string directly to an `<input type="color" />`.
- **Fix:** Use the helper method `colord(value).toHex()` before passing it to the input `value` prop.

**Charts warning "width(0) and height(0)"**

- **Cause:** Recharts trying to render inside a hidden tab or unmounted container.
- **Fix:** Ensure `ChartContainer` has `minWidth={0}` and `minHeight={0}` on the `ResponsiveContainer`.

**Hydration Mismatch**

- **Cause:** The server renders the default theme (from `config/theme.ts`), but the client renders the saved user theme (from `localStorage`).
- **Fix:** Use a `mounted` check to only render the user's saved theme after the component has mounted on the client.
