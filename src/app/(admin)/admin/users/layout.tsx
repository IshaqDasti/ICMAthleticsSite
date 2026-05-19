import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");
  return <>{children}</>;
}
