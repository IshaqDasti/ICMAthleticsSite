import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image src="/icomd-logo.png" alt="ICM Athletics" width={20} height={20} />
            ICM Athletics
          </Link>
          <p className="text-sm text-muted-foreground">
            Summer League 2026 &copy; ICM Athletics
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/standings" className="hover:text-foreground transition-colors">Standings</Link>
            <Link href="/schedule" className="hover:text-foreground transition-colors">Schedule</Link>
            <Link href="/players" className="hover:text-foreground transition-colors">Players</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
