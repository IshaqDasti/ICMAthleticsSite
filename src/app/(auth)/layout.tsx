import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-2xl mb-8">
        <Image src="/icomd-logo.png" alt="ICM Athletics" width={32} height={32} />
        ICM Athletics
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
