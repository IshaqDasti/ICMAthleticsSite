import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ExternalLink, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "About & Contact",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-4xl font-black mb-8">About & Contact</h1>

      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">Contact Us</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              For any questions, reach out to us at:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="mailto:Mensbasketball@icomd.org"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                <Mail className="w-4 h-4" />
                Mensbasketball@icomd.org
              </a>
              <a
                href="mailto:icmathletics@icomd.org"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                <Mail className="w-4 h-4" />
                icmathletics@icomd.org
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">Stay Connected</h2>
          <p className="text-muted-foreground mb-3">
            Stay up to date on the latest news:
          </p>
          <a
            href="https://www.instagram.com/icmathletics/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            @icmathletics on Instagram
          </a>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-bold mb-4">More Info</h2>
          <p className="text-muted-foreground mb-4">
            All players are expected to adhere to the following guidelines:
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/codeofconduct"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <FileText className="w-4 h-4" />
              Code of Conduct
            </a>
            <Link
              href="/rulebook"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <FileText className="w-4 h-4" />
              Rule Book
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
