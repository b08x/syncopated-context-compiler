import * as React from "react";
import { cn } from "@/src/lib/utils";

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  size = "md",
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        checked ? "bg-brand-orange" : "bg-muted-foreground/30 hover:bg-muted-foreground/40",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out",
          size === "sm"
            ? cn("h-3 w-3", checked ? "translate-x-3.5" : "translate-x-0.5")
            : cn("h-4 w-4", checked ? "translate-x-4.5" : "translate-x-0.5")
        )}
      />
    </button>
  );
}
