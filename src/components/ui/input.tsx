import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#e3e5df] bg-white px-4 py-2 text-sm text-ink placeholder:text-[#a3a69f] focus-visible:border-[#829071]",
          className
        )}
        {...props}
      />
    );
  }
);
