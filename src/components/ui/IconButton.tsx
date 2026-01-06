import {ButtonHTMLAttributes, ReactNode} from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // For accessibility
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-3"
};

/**
 * Icon-only button with accessibility label
 * Provides consistent styling for icon actions
 */
export default function IconButton({
  icon,
  label,
  size = "md",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-lg
        transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}
