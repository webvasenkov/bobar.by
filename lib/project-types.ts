export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  desktopImage: string;
  mobileImage: string;
  desktopImages: string[];
  mobileImages: string[];
  imagePlaceholders?: Record<string, string>;
  published: boolean;
  position: number;
  version: number;
}
