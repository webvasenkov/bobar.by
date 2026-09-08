import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://bobar.by", changeFrequency: "monthly", priority: 1 }];
}
