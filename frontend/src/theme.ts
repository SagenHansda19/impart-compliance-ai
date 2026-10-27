export type Theme = "dark" | "light";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "dark";
  try {
    const saved = localStorage.getItem("impart-theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return "dark"; // Default to professional dark mode
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
  try {
    localStorage.setItem("impart-theme", theme);
  } catch {
    // ignore
  }
}
