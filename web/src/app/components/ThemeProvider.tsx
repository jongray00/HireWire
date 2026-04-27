export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark mode is hardcoded in root.tsx HTML element
  // This component is now a simple passthrough to prevent hydration issues
  return <>{children}</>;
}
