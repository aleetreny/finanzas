import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    name: "Mis gastos",
    short_name: "Mis gastos",
    description: "Tu libreta privada de gastos e ingresos.",
    start_url: `${basePath}/dashboard/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f4f0e4",
    theme_color: "#24211a",
    orientation: "portrait-primary",
    icons: [
      {
        src: `${basePath}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Anotar un gasto",
        short_name: "Anotar",
        description: "Abrir directamente el registro rápido de gastos.",
        url: `${basePath}/movimientos/nuevo/`,
        icons: [
          {
            src: `${basePath}/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
