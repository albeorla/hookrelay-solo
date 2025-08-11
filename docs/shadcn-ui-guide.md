# shadcn/ui Implementation Guide

This project uses a **cutting-edge shadcn/ui setup** with Tailwind v4, representing best practices as of July 2025.

## 🎯 Current Implementation

### Tailwind v4 Setup
- **Version**: `tailwindcss@4.0.15` (bleeding edge)
- **Configuration**: Using new `@theme` directive in `globals.css`
- **PostCSS**: `@tailwindcss/postcss@4.0.15` for build optimization
- **No traditional config file**: Leveraging Tailwind v4's simplified approach

### shadcn/ui Configuration
```json
{
  "style": "default",           // Legacy style (consider upgrading to "new-york")
  "rsc": true,                 // React Server Components support
  "tsx": true,                 // TypeScript support
  "tailwind": {
    "config": "tailwind.config.js",  // References non-existent file
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  }
}
```

## 🧩 Component Architecture

### Complete Component Suite
- accordion.tsx
- alert-dialog.tsx
- alert.tsx
- avatar.tsx
- badge.tsx
- button.tsx
- calendar.tsx
- card.tsx
- checkbox.tsx
- context-menu.tsx
- dialog.tsx
- dropdown-menu.tsx
- form.tsx
- hover-card.tsx
- input.tsx
- label.tsx
- menubar.tsx
- navigation-menu.tsx
- popover.tsx
- progress.tsx
- radio-group.tsx
- select.tsx
- sheet.tsx
- slider.tsx
- switch.tsx
- table.tsx
- tabs.tsx
- toast.tsx
- tooltip.tsx

### Variant Management
```typescript
// Using Class Variance Authority (CVA)
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { default: "...", destructive: "..." },
      size: { default: "...", sm: "...", lg: "..." }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)
```

## 🎨 Styling Approach

### Modern Tailwind v4 Features
```css
/* globals.css - Using @theme directive */
@import "tailwindcss";

@theme {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}
```

### Utility Function
```typescript
// ~/lib/utils.ts - Standard shadcn/ui utility
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## 🔧 Development Workflow

### Adding New Components
```bash
# Use shadcn CLI to add components
npx shadcn-ui add [component-name]

# All components include:
# - Radix UI primitive
# - Tailwind styling
# - TypeScript definitions
# - data-slot attributes
```

### Customizing Components
1. **Modify variants** in component files directly
2. **Update CSS variables** in globals.css `@theme` block
3. **Extend utilities** in utils.ts for complex styling logic

## 📊 Performance Benefits

### Tailwind v4 Advantages
- **5× faster rebuilds** compared to v3
- **100× faster incremental builds**
- **Smaller bundle sizes** with native CSS optimization
- **Built-in CSS-in-JS** performance without runtime overhead

### shadcn/ui Benefits
- **Zero runtime JS** - pure CSS styling
- **Tree-shakeable** - only used components are bundled  
- **Type-safe variants** - compile-time validation
- **Consistent design system** - unified component API

## 🚀 Best Practices

### Component Usage
```tsx
// Proper usage with cn utility
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

<Button 
  variant="destructive" 
  size="lg"
  className={cn("additional-classes", conditional && "conditional-classes")}
>
  Action
</Button>
```

### Theming
```css
/* Add custom colors to @theme block */
@theme {
  --color-brand-primary: oklch(0.5 0.2 250);
  --color-brand-secondary: oklch(0.7 0.15 280);
}
```

## 🔄 Migration Notes

### From Tailwind v3
- Remove `tailwind.config.js` file
- Move theme configuration to `@theme` directive
- Update CSS imports to use `@import "tailwindcss"`

### shadcn/ui Updates
- Consider upgrading from "default" to "new-york" style
- All components use latest Radix UI versions
- Lucide icons are the current standard

## 🎯 Interview Ready Points

1. **Architecture**: This setup represents the **latest shadcn/ui best practices** (July 2025)
2. **Performance**: Tailwind v4 provides significant build performance improvements
3. **Type Safety**: Full TypeScript integration with variant props
4. **Maintainability**: "Copy-paste" philosophy means no hidden abstractions
5. **Modern Stack**: Next.js 15 + React 19 + Tailwind v4 cutting-edge combination

---

**Last Updated**: October 2024  
**shadcn/ui Version**: Latest CLI with Tailwind v4 support  
**Tailwind Version**: 4.0.15 (bleeding edge)