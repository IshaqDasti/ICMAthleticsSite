import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Code of Conduct",
};

const CODE_OF_CONDUCT_URL =
  "https://docs.google.com/document/d/e/2PACX-1vR8baWkLJOICwnc17rIDiJAgMJDfiXDSEg4qHAVyMigICQfWcSOPGGJqlr4QsbCB7mcmgSZ_DSTN7S6/pub";

export default function CodeOfConductPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="container mx-auto px-4 pt-8 pb-4 flex items-center justify-between shrink-0">
        <h1 className="text-4xl font-black">Code of Conduct</h1>
        <a
          href={CODE_OF_CONDUCT_URL}
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
            src={`${CODE_OF_CONDUCT_URL}?embedded=true`}
            className="w-full h-full"
            title="ICM Athletics Code of Conduct"
          />
        </div>
      </div>
    </div>
  );
}
