"use client";

import { useEffect } from "react";
import { useStoredState } from "../data/state";

export type ThemePref = "light" | "dark" | "system";

/** Runs before paint (inline in the admin layout) so dark mode never flashes. */
export const THEME_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("adm:theme")||'"system"');var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-admin-theme",d?"dark":"light")}catch(e){}})();`;

export function useTheme() {
  const [pref, setPref] = useStoredState<ThemePref>("adm:theme", "system");
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && mq.matches);
      document.documentElement.setAttribute("data-admin-theme", dark ? "dark" : "light");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);
  return { pref, setPref };
}
