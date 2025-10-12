"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function NavigationBar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <Icon name="mic" size="lg" className="text-primary" />
            <span className="text-xl font-bold">RecTime</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Record
            </Link>
            <Link
              href="/recordings"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/recordings"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              Recordings
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
          </Button>
        </div>
      </div>
    </nav>
  );
}
