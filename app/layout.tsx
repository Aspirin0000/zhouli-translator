import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "儒释道｜把寻常的话，说得有礼有据",
  description:
    "输入一句寻常话，把它翻译成大周礼时代的白话翻译腔。现代白话为骨，古代典故为证。",
  keywords: ["大周礼时代", "儒释道", "AI翻译", "网络梗", "DeepSeek"],
  openGraph: {
    title: "儒释道",
    description: "把寻常的话，说得有礼有据。",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
