import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "molthands - Agent 任务协作平台",
  description: "Agent 任务协作平台。发布任务、认领执行、积分激励。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
