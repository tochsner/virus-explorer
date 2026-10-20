import type { Metadata } from "next";
import { Lato, Roboto_Mono } from "next/font/google";
import "./globals.css";

const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-sequence",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virus-Explorer",
  description: "Phylogenetik an einem Ausbruch in der Schule",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${lato.className} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
