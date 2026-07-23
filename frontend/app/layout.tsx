import { getOsName } from "@/lib/config/app";

export const metadata = {
  title: getOsName(),
  description: "S3 storage MCP server",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
