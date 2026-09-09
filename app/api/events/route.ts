import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, created_at, payload, processed, processing_result, processed_at")
    .eq("source", "instagram")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, events: data ?? [] });
}
