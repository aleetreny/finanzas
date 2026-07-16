import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    name: "Mis gastos",
    short_name: "Mis gastos",
    description: "Mi libreta de gastos, escrita a mano.",
    start_url: `${basePath}/dashboard/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f4f0e4",
    theme_color: "#24211a",
    orientation: "portrait-primary",
    icons: [
      {
        src: `${basePath}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
