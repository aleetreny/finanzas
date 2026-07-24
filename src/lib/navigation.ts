export function appRouteHref(path: string) {
  if (!path.startsWith("/")) return path;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const route = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return `${basePath}${route}`;
}
