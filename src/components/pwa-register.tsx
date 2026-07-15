"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`);
    }
  }, []);

  return null;
}
