import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "../../lib/utils";

/*
<button className="px-6 py-2 rounded-xl border border-gray-300 font-semibold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer">
      Log in
</button>
*/

const buttonVariants = cva(
  // Base styles — áp dụng cho MỌI variant
  "inline-flex items-center justify-center rounded-xl  text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-brand hover:bg-brand-hover text-white",
        outline:
          "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
        ghost: "hover:bg-gray-100 text-gray-700",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        default: "px-6 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-9 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
