import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.5";

const INVITE_HASH = "b82b7eacdd22f1e519721f3b00a32a04e38b94c5779a09ed32bc74522dd0f9b4";
const PRODUCTION_ORIGIN = "https://aleetreny.github.io";
const LOCAL_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
  "http://localhost:3000",
  "http://localhost:3100",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin === PRODUCTION_ORIGIN || (origin && LOCAL_ORIGINS.has(origin))
    ? origin
    : PRODUCTION_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function response(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return response(origin, 405, { error: "Método no permitido." });
  }
  if (origin !== PRODUCTION_ORIGIN && (!origin || !LOCAL_ORIGINS.has(origin))) {
    return response(origin, 403, { error: "Origen no permitido." });
  }

  let input: {
    email?: unknown;
    password?: unknown;
    display_name?: unknown;
    invite?: unknown;
    website?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return response(origin, 400, { error: "Solicitud no válida." });
  }

  // A hidden honeypot rejects basic form bots without revealing the reason.
  if (typeof input.website === "string" && input.website.trim()) {
    return response(origin, 400, { error: "No se pudo crear la cuenta." });
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
  const invite = typeof input.invite === "string" ? input.invite : "";
  if (await sha256(invite) !== INVITE_HASH) {
    return response(origin, 403, { error: "Abre el enlace de invitación completo para crear una cuenta." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response(origin, 400, { error: "Indica un correo electrónico válido." });
  }
  if (password.length < 10 || password.length > 72) {
    return response(origin, 400, { error: "La clave debe tener entre 10 y 72 caracteres." });
  }
  if (displayName.length < 1 || displayName.length > 80) {
    return response(origin, 400, { error: "Indica un nombre de hasta 80 caracteres." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response(origin, 503, { error: "El alta no está disponible temporalmente." });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
  const fingerprint = await sha256(`${INVITE_HASH}:${forwarded}`);
  const { data: allowed, error: rateError } = await admin.rpc(
    "consume_signup_attempt",
    { p_fingerprint: fingerprint },
  );
  if (rateError) {
    console.error("signup rate-limit error", rateError.code);
    return response(origin, 503, { error: "El alta no está disponible temporalmente." });
  }
  if (!allowed) {
    return response(origin, 429, { error: "Demasiados intentos. Prueba de nuevo dentro de una hora." });
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError) {
    const existing = createError.message.toLowerCase().includes("already")
      || createError.message.toLowerCase().includes("registered");
    if (!existing) console.error("public signup error", createError.code);
    return response(origin, existing ? 409 : 400, {
      error: existing
        ? "Ya existe una cuenta con ese correo. Entra con tu clave o recupera el acceso."
        : "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    });
  }

  return response(origin, 201, { created: true });
});
