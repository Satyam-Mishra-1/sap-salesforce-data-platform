import type { Config } from "tailwindcss";

const colors = ["blue","red","green","purple","orange","amber","cyan","indigo","teal","violet","rose","slate","gray","yellow"];
const shades = ["50","100","200","300","400","500","600","700","800","900"];

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [],
  safelist: [
    ...colors.flatMap((c) =>
      shades.flatMap((s) => [
        `bg-${c}-${s}`,
        `text-${c}-${s}`,
        `border-${c}-${s}`,
        `dark:bg-${c}-${s}`,
        `dark:text-${c}-${s}`,
        `dark:border-${c}-${s}`,
      ])
    ),
    // opacity variants used in ProblemCard backgrounds
    ...colors.map((c) => `bg-${c}-950/20`),
    ...colors.map((c) => `dark:bg-${c}-950/20`),
    ...colors.map((c) => `bg-${c}-950/30`),
    ...colors.map((c) => `dark:bg-${c}-950/30`),
    ...colors.map((c) => `bg-${c}-900/40`),
    ...colors.map((c) => `dark:bg-${c}-900/40`),
    ...colors.map((c) => `bg-${c}-900/50`),
    ...colors.map((c) => `dark:bg-${c}-900/50`),
  ],
};
export default config;
