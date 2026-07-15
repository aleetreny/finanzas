import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    name: "Finanzas personales",
    short_name: "Finanzas",
    description: "Panel privado de finanzas personales y del Piso Málaga.",
    start_url: `${basePath}/dashboard/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f4f3ee",
    theme_color: "#18352f",
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
