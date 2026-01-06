/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media", // Use system preference instead of manual class
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {DEFAULT: "#495057", dark: "#adb5bd"},
        background: {DEFAULT: "#e9ecef", dark: "#212529"},
        bookmark: "#fd7e14",
        // Apple-inspired colors
        apple: {
          blue: "#007aff",
          "blue-dark": "#0a84ff",
          orange: "#ff9500",
          "orange-dark": "#ff9f0a",
          red: "#ff3b30",
          green: "#34c759"
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Segoe UI"',
          "system-ui",
          "sans-serif"
        ],
        mono: [
          '"SF Mono"',
          "Monaco",
          '"Cascadia Code"',
          '"Courier New"',
          "monospace"
        ]
      },
      borderRadius: {
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      boxShadow: {
        "sm-apple": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "md-apple": "0 2px 8px -2px rgb(0 0 0 / 0.08)",
        "lg-apple": "0 8px 16px -4px rgb(0 0 0 / 0.1)",
        "xl-apple": "0 16px 32px -8px rgb(0 0 0 / 0.12)"
      },
      transitionDuration: {
        150: "150ms"
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
      },
      backdropBlur: {
        xl: "20px"
      },
      backdropSaturate: {
        150: "1.5"
      },
      keyframes: {
        "pulse-recording": {
          "0%, 100%": {
            boxShadow:
              "0 8px 16px -4px rgb(0 0 0 / 0.1), 0 0 0 0 rgba(255, 59, 48, 0.4)"
          },
          "50%": {
            boxShadow:
              "0 16px 32px -8px rgb(0 0 0 / 0.12), 0 0 0 20px rgba(255, 59, 48, 0)"
          }
        },
        "pulse-success": {
          "0%, 100%": {transform: "scale(1)"},
          "50%": {transform: "scale(1.15)"}
        },
        fadeIn: {
          from: {opacity: "0"},
          to: {opacity: "1"}
        },
        slideUp: {
          from: {transform: "translateY(100%)"},
          to: {transform: "translateY(0)"}
        }
      },
      animation: {
        "pulse-recording": "pulse-recording 2s ease-in-out infinite",
        "pulse-success": "pulse-success 0.5s ease-in-out",
        fadeIn: "fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        slideUp: "slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)"
      },
      scale: {
        98: "0.98",
        120: "1.2"
      }
    }
  },
  plugins: []
};
