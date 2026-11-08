
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] as string));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!botToken || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing server secrets");
    }

    const body = await req.json();
    const load = body?.load;
    if (!load?.id || !load?.city_from || !load?.city_to) {
      return new Response(JSON.stringify({ ok: false, error: "Load details are incomplete" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: subscribers, error: selectError } = await supabase
      .from("telegram_subscribers")
      .select("chat_id");
    if (selectError) throw selectError;

    const uniqueChatIds = [...new Set((subscribers ?? []).map((row) => String(row.chat_id)).filter(Boolean))];
    if (!uniqueChatIds.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No Telegram subscribers yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weight = Number(load.weight_tons || 0);
    const weightText = weight > 0
      ? (weight < 1
        ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(weight * 1000)} кг`
        : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(weight)} т`)
      : "Көрсөтүлгөн эмес";

    const priceText = Number(load.price || 0) > 0
      ? `${new Intl.NumberFormat("ru-RU").format(Number(load.price))} сом`
      : "Баасы сүйлөшүү аркылуу";

    const lines = [
      "🚚 <b>ЖАҢЫ ЖҮК ЖАРЫЯСЫ!</b>",
      `📍 <b>${escapeHtml(load.city_from)} → ${escapeHtml(load.city_to)}</b>`,
      `📦 Жүк: ${escapeHtml(load.cargo || load.title || "Жүк")}`,
      `⚖️ Салмагы: ${escapeHtml(weightText)}`,
      `💰 Баасы: ${escapeHtml(priceText)}`,
    ];

    if (Number(load.route_km) > 0) lines.push(`🛣️ Аралык: ${escapeHtml(load.route_km)} км`);
    if (load.phone) lines.push(`☎️ Байланыш: ${escapeHtml(load.phone)}`);
    lines.push("\nЖарыяны көрүү: https://timon19991404-byte.github.io/juk-express-kg/");

    const message = lines.join("\n");
    let sent = 0;
    let failed = 0;

    for (const chatId of uniqueChatIds) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }),
      });

      if (response.ok) sent++;
      else {
        failed++;
        console.error("Telegram send failed:", chatId, response.status, await response.text());
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, total: uniqueChatIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-new-load error:", error);
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Internal error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
