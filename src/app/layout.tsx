import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Pallerlamudi Connect", description: "Village reporting and public information" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
