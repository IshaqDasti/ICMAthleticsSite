import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Rule Book",
};

const RULEBOOK_URL =
  "https://docs.google.com/document/d/e/2PACX-1vQaz1AL5tZAHt8qiJh2j5E7Nww0MaO7mrjM9yNrgTwFCHDjXAiOTdfYKn8OtBrLp5X1TKy2lJqfqafl/pub";

export default function RuleBookPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="container mx-auto px-4 pt-8 pb-4 flex items-center justify-between shrink-0">
        <h1 className="text-4xl font-black">Rule Book</h1>
        <a
          href={RULEBOOK_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
      </div>

      <div className="container mx-auto px-4 pb-6 flex-1 min-h-0">
        <div className="rounded-xl border bg-card overflow-hidden h-full">
          <iframe
            src={`${RULEBOOK_URL}?embedded=true`}
            className="w-full h-full"
            title="ICM Athletics Rule Book"
          />
        </div>
      </div>
    </div>
  );
}
