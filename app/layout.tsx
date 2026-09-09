import type { Metadata } from "next";
import "./globals.css";

const title = "BOBAR – разработка сайтов для бизнеса в Беларуси";
const description =
  "Создаю современные сайты для бизнеса: лендинги, корпоративные сайты и интернет-магазины. Индивидуальная разработка без студийной наценки.";
export const metadata: Metadata = {
  metadataBase: new URL("https://bobar.by"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "https://bobar.by",
    siteName: "BOBAR",
    locale: "ru_BY",
    type: "website",
  },
  twitter: { card: "summary", title, description },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preload" href="/fonts/arimo-latin-cyrillic-v1.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "BOBAR",
              url: "https://bobar.by",
              inLanguage: "ru",
              description,
            }),
          }}
        />
      </body>
    </html>
  );
}
