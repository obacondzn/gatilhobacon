import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SELECT_FIELDS = `
  id,
  name,
  is_active,
  trigger_type,
  content_id,
  keywords,
  match_mode,
  ai_mode,
  static_reply,
  ai_system_prompt,
  qualifier_id,
  created_at,
  updated_at,
  active,
  processing_result
`;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("automations")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Automations GET error:", error);

    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    automations: data ?? [],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const keyword = String(body?.keyword || "")
      .trim()
      .toLowerCase();

    const response = String(body?.response || "").trim();

    if (!keyword || !response) {
      return NextResponse.json(
        {
          ok: false,
          message: "Palavra-chave e resposta são obrigatórias.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("automations")
      .insert({
        name: body?.name || `Comentário ${keyword}`,
        is_active: body?.active !== false,
        trigger_type: "comment",
        keywords: [keyword],
        match_mode: "contains",
        ai_mode: false,
        static_reply: response,
        active: body?.active !== false,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      console.error("Automations POST error:", error);

      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      automation: data,
    });
  } catch (error) {
    console.error("Automations POST exception:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível criar a automação.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = String(body?.id || "").trim();
    const keyword = String(body?.keyword || "")
      .trim()
      .toLowerCase();
    const response = String(body?.response || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID da automação não informado.",
        },
        { status: 400 }
      );
    }

    if (!keyword || !response) {
      return NextResponse.json(
        {
          ok: false,
          message: "Palavra-chave e resposta são obrigatórias.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("automations")
      .update({
        keywords: [keyword],
        static_reply: response,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      console.error("Automations PUT error:", error);

      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      automation: data,
    });
  } catch (error) {
    console.error("Automations PUT exception:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível atualizar a automação.",
      },
      { status: 500 }
    );
  }
}