import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "세나리 길드 관리",
  description: "세븐나이츠 리버스 세나리 길드 콘텐츠 참여 기록과 시즌별 운영 현황을 관리합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
