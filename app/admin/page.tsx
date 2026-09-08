import type { Metadata } from "next";
import { PortfolioAdmin } from "@/components/bobar/portfolio-admin";
import "./admin.css";

export const metadata: Metadata = {
  title: "Работы – BOBAR",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};

export default function AdminPage() { return <PortfolioAdmin />; }
