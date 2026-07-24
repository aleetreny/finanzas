import type { ComponentPropsWithoutRef } from "react";
import { appRouteHref } from "@/lib/navigation";

type AppLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

// La aplicación se publica como exportación estática en GitHub Pages. Un
// enlace nativo evita que el router solicite fragmentos RSC que ese hosting no
// puede reescribir y conserva una navegación fiable incluso sin JavaScript.
export function AppLink({ href, ...props }: AppLinkProps) {
  return <a href={appRouteHref(href)} {...props} />;
}
