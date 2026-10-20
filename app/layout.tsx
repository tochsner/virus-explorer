import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Virus-Explorer",
  description: "Phylogenetik an einem Ausbruch in der Schule",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={rubik.className}>
      <body>{children}</body>
    </html>
  );
}
