import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anaïs",
    short_name: "Anaïs",
    description: "Experiencia privada. Notificaciones neutras.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    orientation: "portrait",
    lang: "es",
  };
}
