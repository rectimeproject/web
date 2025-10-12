# Migration Guide: CRA to Next.js

This document outlines the migration from Create React App to Next.js 14 with TailwindCSS.

## Major Changes

### 1. Project Structure

- **Before**: `/src` with React components
- **After**: `/src/app` (Next.js App Router) + `/src/components` + `/src/lib` + `/src/hooks`

### 2. Routing

- **Before**: React Router (`react-router-dom`)
- **After**: Next.js App Router (file-based routing)
  - `/src/app/page.tsx` → Home/Record screen
  - `/src/app/recordings/page.tsx` → Recordings list
  - `/src/app/recording/[recordingId]/page.tsx` → Recording detail

### 3. Styling

- **Before**: SCSS/CSS modules + Bootstrap
- **After**: TailwindCSS with custom design system
  - CSS variables for theming
  - Dark/light mode support
  - Responsive design utilities

### 4. Components Migration

#### NavigationBar

- Migrated to TailwindCSS
- Added theme toggle button
- Uses Next.js `Link` and `usePathname`

#### Button

- Custom Tailwind component with variants
- Replaces Bootstrap buttons
- Support for different sizes and styles

#### Card Components

- New card system with Header, Content, Footer
- Consistent styling across app

#### Icons

- Still uses Material Icons
- Wrapped in custom component with Tailwind sizing

### 5. Scripts Changes

```json
// Before
{
  "start": "react-scripts start",
  "build": "react-scripts build"
}

// After
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start"
}
```

### 6. Dependencies Removed

- `react-scripts`
- `react-router-dom`
- `bootstrap`
- `sass`

### 7. Dependencies Added

- `next` (^14.0.4)
- `tailwindcss` (^3.4.0)
- `next-themes` (^0.2.1)
- `clsx` + `tailwind-merge`

### 8. Client vs Server Components

All pages and components that use:

- State (`useState`)
- Effects (`useEffect`)
- Browser APIs
- Context

Must be marked with `'use client'` directive at the top.

### 9. Configuration Files

#### New Files

- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration
- `.eslintrc.json` - ESLint for Next.js

#### Modified Files

- `tsconfig.json` - Updated for Next.js
- `package.json` - New scripts and dependencies

## Migration Steps

1. ✅ Install Next.js and dependencies
2. ✅ Create Next.js app structure
3. ✅ Configure TailwindCSS
4. ✅ Set up theme provider
5. ✅ Migrate utility functions
6. ✅ Create UI component library
7. ✅ Migrate pages to App Router
8. ✅ Update configuration files
9. ⏳ Install dependencies: `npm install`
10. ⏳ Test application: `npm run dev`

## Breaking Changes

1. **Routing**: Must update all navigation to use Next.js Link
2. **Images**: Should use Next.js Image component for optimization
3. **Metadata**: Use Next.js Metadata API instead of react-helmet
4. **CSS**: Replace all SCSS/Bootstrap with Tailwind classes

## Next Steps

After basic migration:

1. Add loading states with `loading.tsx`
2. Add error boundaries with `error.tsx`
3. Implement server components where possible
4. Add metadata for SEO
5. Optimize images with Next.js Image
6. Add middleware if needed
7. Set up environment variables
8. Configure deployment (Vercel/other)

## Testing Checklist

- [ ] Recording starts/stops correctly
- [ ] Audio visualization works
- [ ] Recordings list loads
- [ ] Individual recording playback works
- [ ] Theme toggle works
- [ ] Storage information displays
- [ ] Responsive design works on mobile
- [ ] Dark mode displays correctly
- [ ] All routes navigate properly

## Support

For issues, check:

1. Browser console for errors
2. Next.js documentation: https://nextjs.org/docs
3. TailwindCSS documentation: https://tailwindcss.com/docs
