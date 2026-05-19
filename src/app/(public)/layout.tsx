import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Footer } from "@/components/layout/Footer";
import { LiveGameBanner } from "@/components/layout/LiveGameBanner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      <LiveGameBanner />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
