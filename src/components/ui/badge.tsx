import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        admin:
          "border-transparent bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm [a&]:hover:shadow-md [a&]:hover:from-red-600 [a&]:hover:to-orange-600",
        user: "border-transparent bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm [a&]:hover:shadow-md [a&]:hover:from-blue-600 [a&]:hover:to-indigo-600",
        test: "border-transparent bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm [a&]:hover:shadow-md [a&]:hover:from-purple-600 [a&]:hover:to-pink-600",
        permission:
          "border-transparent bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm [a&]:hover:shadow-md [a&]:hover:from-emerald-600 [a&]:hover:to-teal-600",
        success:
          "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm [a&]:hover:shadow-md",
        warning:
          "border-transparent bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-sm [a&]:hover:shadow-md",
        info: "border-transparent bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm [a&]:hover:shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

// Helper function to get role-specific badge variant
function getRoleBadgeVariant(
  role: string,
): VariantProps<typeof badgeVariants>["variant"] {
  const roleUpper = role.toUpperCase();
  switch (roleUpper) {
    case "ADMIN":
      return "admin";
    case "USER":
      return "user";
    case "TEST":
      return "test";
    default:
      return "secondary";
  }
}

// Helper function to get permission badge variant
function getPermissionBadgeVariant(
  permission: string,
): VariantProps<typeof badgeVariants>["variant"] {
  if (permission.startsWith("manage:")) return "permission";
  if (permission.startsWith("view:")) return "info";
  return "secondary";
}

export { Badge, badgeVariants, getRoleBadgeVariant, getPermissionBadgeVariant };
