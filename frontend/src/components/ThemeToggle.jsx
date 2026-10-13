import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

// buttonClassName lets a page restyle the trigger; the website keeps the default look
export default function ThemeToggle({ buttonClassName } = {}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const CurrentIcon =
    theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <div ref={dropdownRef} className="relative z-50 select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 hover:scale-105 cursor-pointer relative"}
        title={`Theme: ${theme}`}
      >
        <CurrentIcon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
        <span className="sr-only">Toggle theme</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 shadow-2xl p-1.5 animate-fadeIn">
          {options.map((opt) => {
            const OptIcon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <OptIcon className="h-4 w-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
