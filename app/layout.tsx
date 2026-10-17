import "./globals.css";
import { ClientProvider } from "./client-provider";
export const metadata = {
  title: "UNBORED",
  description: "Shared real-time conversations",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
