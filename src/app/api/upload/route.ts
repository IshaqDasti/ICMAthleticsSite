export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createClient } from "@/lib/supabase/server";

export const POST = withAuth(async (req) => {
  const { bucket, path, contentType } = await req.json();

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket ?? "public")
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: supabase.storage.from(bucket ?? "public").getPublicUrl(path).data.publicUrl,
  });
}, "TEAM_MANAGER");
