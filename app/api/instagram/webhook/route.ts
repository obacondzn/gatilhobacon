import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { processPendingEvents } from "@/lib/processor";

function verifyInstagramSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
) {
  if (!signatureHeader) {
    return false;
  }

  const [algorithm, receivedSignature] = signatureHeader.split("=");

  if (algorithm !== "sha256" || !receivedSignature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token === verifyToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: "Verificação do webhook recusada.",
    },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "INSTAGRAM_APP_SECRET não configurado.",
      },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyInstagramSignature(rawBody, signature, appSecret)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Assinatura do webhook inválida.",
      },
      { status: 401 }
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Payload JSON inválido.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("events")
    .insert({
      source: "instagram",
      event_type: "webhook",
      payload,
      processed: false,
    });

  if (error) {
    console.error("Erro ao registrar evento do Instagram:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível registrar o evento.",
      },
      { status: 500 }
    );
  }

  // O evento já está persistido. Processamos em seguida, mas uma falha na
  // automação não impede o webhook de responder 200 para a Meta.
  try {
    await processPendingEvents(10);
  } catch (error) {
    console.error("Erro ao processar evento do Instagram:", error);
  }

  return NextResponse.json({ ok: true });
}