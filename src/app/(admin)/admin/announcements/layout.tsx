import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function AnnouncementsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session || session.role === "SCOREKEEPER") redirect("/admin");
  return <>{children}</>;
}
