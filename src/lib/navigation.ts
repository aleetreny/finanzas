export function appRouteHref(path: string) {
  if (!path.startsWith("/")) return path;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const route = pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
  return `${basePath}${route}${suffix}`;
}
