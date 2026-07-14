import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "合乎周礼｜问礼成文，释礼还意",
  description:
    "输入一句寻常话，把它翻译成大周礼时代的白话翻译腔；也可粘贴周礼体，释礼翻回直接人话。",
  keywords: ["大周礼时代", "合乎周礼", "释礼", "AI翻译", "网络梗", "DeepSeek"],
  openGraph: {
    title: "合乎周礼",
    description: "问礼成文，释礼还意。",
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
      <head>
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-500.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/zhouli-serif-ui-600.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
