import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10) || 1
  );

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, instagram_user_id, username, name, avatar_url, first_interaction_at, last_interaction_at, interaction_count, conversation_count, recurring, classification, interests, topics",
      { count: "exact" }
    )
    .order("recurring", { ascending: false })
    .order("last_interaction_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Contacts GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    contacts: data ?? [],
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}