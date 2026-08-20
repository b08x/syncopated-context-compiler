import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("theme") as "light" | "dark" | null;
      if (stored && stored !== theme) {
        setTheme(stored);
      }
    };
    
    // Listen to local storage changes from other tabs
    window.addEventListener("storage", handleStorage);
    // Listen to custom event from same tab
    window.addEventListener("theme-change", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theme-change", handleStorage);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("theme", next);
      window.dispatchEvent(new Event("theme-change"));
      return next;
    });
  };

  return { theme, toggleTheme };
}
