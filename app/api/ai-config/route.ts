import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("ai_config")
    .select("tone, personality, instructions")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("AI config GET error:", error);

    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    config: data ?? {
      tone: "Informal",
      personality: "Criativo, descontraído e brasileiro.",
      instructions: "Fale como eu falaria.",
    },
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const tone = String(body?.tone || "").trim();
    const personality = String(body?.personality || "").trim();
    const instructions = String(body?.instructions || "").trim();

    if (!tone || !personality) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tom e personalidade são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("ai_config")
      .upsert({
        id: true,
        tone,
        personality,
        instructions,
        updated_at: new Date().toISOString(),
      })
      .select("tone, personality, instructions")
      .single();

    if (error) {
      console.error("AI config PUT error:", error);

      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, config: data });
  } catch (error) {
    console.error("AI config PUT exception:", error);

    return NextResponse.json(
      { ok: false, message: "Não foi possível salvar a configuração da IA." },
      { status: 500 }
    );
  }
}
