import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Brief — Daily Edition",
  description: "Abdulla's private, layered daily intelligence publication.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
