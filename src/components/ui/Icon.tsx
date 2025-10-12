"use client";

import { cn } from "@/lib/utils";

export interface IconProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Icon({ name, className, size = "md" }: IconProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-4xl",
  };

  return (
    <span
      className={cn(
        "material-icons inline-flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {name}
    </span>
  );
}
