import {ReactNode} from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card/Panel container with consistent styling
 */
export default function Panel({children, className = ""}: PanelProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-700
        rounded-lg
        shadow-sm
        ${className}
      `}
    >
      {children}
    </div>
  );
}
