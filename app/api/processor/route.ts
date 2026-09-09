import { NextResponse } from "next/server";
import { processPendingEvents } from "@/lib/processor";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit) || 10, 50);
    const results = await processPendingEvents(limit);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("Processor error:", error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
