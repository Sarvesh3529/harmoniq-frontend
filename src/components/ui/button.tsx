import * as React from "react";

type ButtonVariant = "default" | "outline" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "border-transparent bg-white text-zinc-950 hover:bg-zinc-200",
  outline: "border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900",
  secondary: "border-zinc-800 bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
});
