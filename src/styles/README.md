# TailwindCSS Style Guide

## Color Palette

### Theme Colors (from tailwind.config.js)

```javascript
colors: {
  primary: {
    DEFAULT: '#495057',  // Gray for light mode
    dark: '#adb5bd'      // Lighter gray for dark mode
  },
  background: {
    DEFAULT: '#e9ecef',  // Light background
    dark: '#212529'      // Dark background
  },
  bookmark: '#fd7e14'    // Orange for bookmarks
}
```

### Semantic Colors

- **Primary Actions**: `bg-blue-600 hover:bg-blue-700`
- **Secondary Actions**: `bg-gray-200 hover:bg-gray-300`
- **Destructive**: `bg-red-600 hover:bg-red-700`
- **Success**: `bg-green-600 hover:bg-green-700`

## Dark Mode

All components should support dark mode using Tailwind's `dark:` variant:

```tsx
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
```

Dark mode is activated via `[data-theme="dark"]` attribute (see tailwind.config.js).

## Spacing Scale

Follow Tailwind's default spacing scale (4px base):

- **xs**: `p-1` (4px)
- **sm**: `p-2` (8px)
- **md**: `p-4` (16px)
- **lg**: `p-6` (24px)
- **xl**: `p-8` (32px)

## Touch Targets

All interactive elements should have minimum 48px touch targets for mobile:

```tsx
// Minimum for buttons
className="min-h-12 min-w-12" // 48px x 48px

// Use padding to expand hit area
className="p-3" // 12px padding = 48px total for 24px icon
```

## Component Patterns

### Buttons

Use the shared Button component:

```tsx
import Button from "./components/ui/Button";

<Button variant="primary" size="md">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger" isLoading>Delete</Button>
```

### Icon Buttons

```tsx
import IconButton from "./components/ui/IconButton";

<IconButton
  icon={<Icon name="close" />}
  label="Close dialog"
  size="md"
/>
```

### Panels/Cards

```tsx
import Panel from "./components/ui/Panel";

<Panel className="p-6">
  <h2>Panel Content</h2>
</Panel>
```

## Transitions

Standard transition for interactive elements:

```tsx
className="transition-colors duration-200"
```

## Focus States

Always include focus rings for accessibility:

```tsx
className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
```

## Responsive Design

Use Tailwind's responsive prefixes:

- **Mobile-first**: Default styles are mobile
- **sm**: `640px` and up (small tablets)
- **md**: `768px` and up (tablets)
- **lg**: `1024px` and up (desktops)
- **xl**: `1280px` and up (large screens)

Example:
```tsx
className="w-full md:w-1/2 lg:w-1/3"
```

## Common Patterns

### Form Input

```tsx
className="
  w-full px-3 py-2
  border border-gray-300 dark:border-gray-600 rounded-lg
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-gray-100
  focus:outline-none focus:ring-2 focus:ring-blue-500
"
```

### Loading Spinner

```tsx
<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
  {/* Circle path */}
</svg>
```

### Truncated Text

```tsx
className="truncate" // Single line
className="line-clamp-2" // Multiple lines (requires plugin)
```

## Migration Checklist

When migrating a component from Bootstrap/SCSS to Tailwind:

- [ ] Replace container classes (`container`, `row`, `col-*`)
- [ ] Replace utility classes (`d-flex`, `mt-3`, etc.)
- [ ] Replace color classes (`bg-primary`, `text-danger`)
- [ ] Add dark mode variants
- [ ] Ensure responsive breakpoints
- [ ] Test touch targets on mobile
- [ ] Verify focus states
- [ ] Remove corresponding SCSS file
