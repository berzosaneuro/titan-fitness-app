"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "anais_discreet_v1";

type Ctx = {
  discreet: boolean;
  setDiscreet: (v: boolean) => void;
  toggleDiscreet: () => void;
};

const DiscreetContext = createContext<Ctx | null>(null);

export function DiscreetModeProvider({ children }: { children: ReactNode }) {
  const [discreet, setDiscreetState] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setDiscreetState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setDiscreet = useCallback((v: boolean) => {
    setDiscreetState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.dataset.discreet = v ? "true" : "false";
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.discreet = discreet ? "true" : "false";
  }, [discreet]);

  const toggleDiscreet = useCallback(() => setDiscreet(!discreet), [discreet, setDiscreet]);

  const value = useMemo(
    () => ({ discreet, setDiscreet, toggleDiscreet }),
    [discreet, setDiscreet, toggleDiscreet]
  );

  return <DiscreetContext.Provider value={value}>{children}</DiscreetContext.Provider>;
}

export function useDiscreetMode() {
  const c = useContext(DiscreetContext);
  if (!c) throw new Error("useDiscreetMode dentro de DiscreetModeProvider");
  return c;
}
