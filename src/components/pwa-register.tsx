"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      void navigator.serviceWorker.register(`${basePath}/sw.js`, {
        scope: `${basePath}/`,
        updateViaCache: "none",
      });
    }
  }, []);

  return null;
}
