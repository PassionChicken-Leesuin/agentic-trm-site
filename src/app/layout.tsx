import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ScrollDriver from "@/components/ScrollDriver";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap", weight: ["400", "500"] });

const TITLE = "Agentic AI Technology Roadmapping";
const DESC =
  "An agent reads a company's documents, decides passage by passage which of five knowledge structures each fact belongs to, " +
  "and builds a technology roadmap from the knowledge base it assembled.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} min-h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ScrollDriver />
        {children}
      </body>
    </html>
  );
}
