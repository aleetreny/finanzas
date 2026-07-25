export function appRouteHref(path: string) {
  if (!path.startsWith("/")) return path;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const route = pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
  return `${basePath}${route}${suffix}`;
}

export function navigateToAppRoute(path: string) {
  // Igual que AppLink: la exportación de GitHub Pages necesita cargar el HTML
  // estático de destino, y no una transición RSC del router de Next.
  // replace evita volver con "atrás" al formulario ya guardado y duplicarlo.
  window.location.replace(appRouteHref(path));
}
