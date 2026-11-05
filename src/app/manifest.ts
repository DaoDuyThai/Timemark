import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TimeMark",
    short_name: "TimeMark",
    description: "Đóng dấu ngày giờ, địa điểm và ghi chú lên ảnh",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
