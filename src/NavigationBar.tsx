import {Link, useLocation} from "react-router-dom";
import Icon from "./Icon.js";

export default function NavigationBar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white hover:opacity-70 transition-opacity duration-150"
          >
            <Icon name="mic" />
            <span className="tracking-tight">RecTime</span>
          </Link>

          {/* Nav items */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors duration-150 ${
                location.pathname === "/"
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Record
            </Link>

            <Link
              to="/recordings"
              className={`text-sm font-medium transition-colors duration-150 ${
                location.pathname === "/recordings"
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Recordings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
