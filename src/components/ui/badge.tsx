import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const variantClass =
    variant === "secondary"
      ? "border-zinc-800 bg-zinc-800 text-zinc-100"
      : "border-zinc-700 bg-zinc-900 text-zinc-200";

  return (
    <div
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variantClass,
        className,
      ].join(" ")}
      {...props}
    />
  );
}
