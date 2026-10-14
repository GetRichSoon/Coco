// Coco Chat: Coco's brain in Coco Cloud. Answers every founder chat message with no device needed.
// Woken by a database trigger on every new chat row (and a 1-minute safety sweep). It ignores the
// request body and only handles rows still marked "new", so calling it twice is harmless.
// Smart answers use Google Gemini when the GEMINI_API_KEY secret is set (free tier); otherwise rules.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const GEMINI = Deno.env.get("GEMINI_API_KEY");

type Msg = { id: number; author: string; body: string; device_id: string | null };

const hinglish = (t: string) => /\b(hai|kya|karo|kar|chala|bajao|kholo|bhai|mujhe|mera|kaise|kaisa|batao|nahi|haan|acha|accha|aur|abhi)\b/i.test(t);
const houseOf = (t: string) =>
  /\b(youtube|video|short|shorts|channel|reel|insta|instagram|thumbnail)\b/i.test(t) ? "gigi"
  : /\b(extension|chrome|app|apk|play ?store|android|website|site)\b/i.test(t) ? "lulu"
  : /\b(download|ebook|e-book|notes|pdf|template|printable)\b/i.test(t) ? "fifi"
  : /\b(roblox|game|games)\b/i.test(t) ? "zaza" : null;
const isDeviceCommand = (t: string) =>
  /^(play|open|khol|chala|chalao|bajao|laga|volume|awaaz|lock|restart|shutdown|sleep|next|previous|pause|resume|mute|ring|status)\b/i.test(t) ||
  /\b(pc|laptop|computer|phone|mobile) (pe|par|me|mein)\b|\bon (my )?(pc|laptop|phone)\b/i.test(t) ||
  /\b(chalao|bajao|kholo|khol do|chala do|laga do)$/i.test(t);
const isWork = (t: string) => /\b(banao|bana do|banana|make|build|create|likho|write|research|design|fix|plan|launch|idea|ideas|script|thumbnail|upload|post|publish|improve|analy[sz]e)\b/i.test(t);
const isStatus = (t: string) => /\b(status|kya chal|update|report|progress|kaha tak|how is|what.*doing|summary)\b/i.test(t);
const isHello = (t: string) => /^(hi|hii+|hello|hey|namaste|namaskar|sup|yo|good (morning|night|evening|afternoon))\b/i.test(t.trim());

async function facts() {
  const [h, a, t, d] = await Promise.all([
    db.from("houses").select("id,name,state,doing").order("sort"),
    db.from("approvals").select("code,what").eq("state", "waiting"),
    db.from("tasks").select("title,status").in("status", ["queued", "running", "needs_yes", "waiting_pc"]).order("created_at", { ascending: false }).limit(8),
    db.from("devices").select("id,name,last_seen"),
  ]);
  return { houses: h.data ?? [], waiting: a.data ?? [], open: t.data ?? [], devices: d.data ?? [] };
}

async function gemini(m: Msg, call: string, f: Awaited<ReturnType<typeof facts>>, history: { role: string; body: string }[]) {
  const sys = `You are Coco, manager of the company Good Space (owners: Mangesh = "Boss", Shreya = "Big Boss"). Houses: Gigi content/YouTube, Lulu products (Chrome extensions, Play apps), Fifi downloads, Zaza Roblox games. Support team Bonbon Club: Lola ideas, Lili research, Remy builds, Vivi design, Margot writes, Cleo videos, Elise QA, Kiki growth, Didi care, Bibi money.
Reply as a warm voice assistant in 1-3 short sentences, in the founder's language (Hindi, Hinglish or English). Call them ${call}. Never invent numbers or facts beyond these:
Houses: ${f.houses.map((h) => `${h.name} (${h.state}): ${h.doing ?? ""}`).join("; ")}
Waiting for YES: ${f.waiting.map((w) => `${w.code} ${w.what}`).join("; ") || "nothing"}
Open tasks: ${f.open.map((t) => `${t.title} [${t.status}]`).join("; ") || "none"}
Return JSON only: {"reply":"...","needs_work":true|false,"task_title":"...","house":"gigi|lulu|fifi|zaza|coco"}. needs_work is true only for real work (build, write, research, video, fix, plan).`;
  const contents = [...history.map((x) => ({ role: x.role === "coco" ? "model" : "user", parts: [{ text: x.body }] })), { role: "user", parts: [{ text: m.body }] }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  return JSON.parse(j.candidates[0].content.parts[0].text);
}

async function handle(m: Msg) {
  const { data: claimed } = await db.from("chat").update({ status: "thinking", handled_by: "coco-cloud" }).eq("id", m.id).eq("status", "new").select("id");
  if (!claimed?.length) return;
  const who = /shreya/i.test(m.author) || (m.device_id ?? "").startsWith("shreya") ? "shreya" : "mangesh";
  const call = who === "shreya" ? "Big Boss" : "Boss";
  const hi = hinglish(m.body);
  const text = m.body.trim();
  let reply = "", taskId: string | null = null;

  try {
    if (isDeviceCommand(text)) {
      // Send it to the founder's own device; that device's Coco Lounge understands the plain words.
      const toPhone = /\b(phone|mobile)\b/i.test(text);
      const target = `${who}-${toPhone ? "phone" : "pc"}`;
      const words = text.replace(/\b(on )?(my )?(pc|laptop|computer|phone|mobile) ?(pe|par|me|mein)?\b/gi, " ").replace(/\s+/g, " ").trim();
      const { data: dev } = await db.from("devices").select("name,last_seen").eq("id", target).single();
      await db.from("commands").insert({ target_device: target, action: "say", args: { text: words }, created_by: `${m.author} via chat`, created_device: m.device_id });
      const on = dev?.last_seen && Date.now() - new Date(dev.last_seen).getTime() < 150000;
      reply = on ? (hi ? `Ho gaya ${call}, ${dev?.name} pe bhej diya: "${words}".` : `Done ${call}, sent to ${dev?.name}: "${words}".`)
        : (hi ? `${call}, ${dev?.name ?? "wo device"} abhi offline hai. 10 minute me online hua to chal jayega.` : `${call}, ${dev?.name ?? "that device"} is offline right now. It will run if it comes online within 10 minutes.`);
    } else {
      const f = await facts();
      let ai: { reply?: string; needs_work?: boolean; task_title?: string; house?: string } | null = null;
      if (GEMINI) {
        const { data: hist } = await db.from("chat").select("role,body").lt("id", m.id).order("id", { ascending: false }).limit(8);
        try { ai = await gemini(m, call, f, (hist ?? []).reverse()); } catch (e) { console.error(e); }
      }
      const work = ai ? !!ai.needs_work : isWork(text);
      if (work) {
        const house = (ai?.house && ai.house !== "coco" ? ai.house : null) ?? houseOf(text);
        const { data: t } = await db.from("tasks").insert({ title: (ai?.task_title || text).slice(0, 140), details: `From chat (${m.author}): ${text}`, house_id: house, needs: "cloud", created_by: `${m.author} via chat`, created_device: m.device_id, ai_checked: true }).select("id").single();
        taskId = t?.id ?? null;
        const team = f.houses.find((h) => h.id === house)?.name ?? "Coco";
        reply = ai?.reply || (hi ? `Theek hai ${call}, ye kaam ${team} ko de diya, Board pe hai. Jo bhi public jayega uske liye pehle aapka YES lunga.` : `Got it ${call}. ${team} has it on the Board. Anything public waits for your YES.`);
      } else if (ai?.reply) {
        reply = ai.reply;
      } else if (isStatus(text) || isHello(text)) {
        const working = f.houses.filter((h) => h.state === "working").map((h) => `${h.name}: ${h.doing ?? ""}`).join(". ");
        const w = f.waiting.length, o = f.open.length;
        reply = hi
          ? `Namaste ${call}! ${working ? working + ". " : ""}${o} kaam chal rahe hain${w ? `, aur ${w} cheezon pe aapka YES chahiye` : ""}.`
          : `Hello ${call}! ${working ? working + ". " : ""}${o} tasks are open${w ? ` and ${w} things need your YES` : ""}.`;
      } else {
        reply = hi
          ? `Samajh gaya ${call}. Kaam ho to "banao" ya "likho" bolo, PC ke liye "pc pe kesariya chalao" jaisa bolo.`
          : `Noted ${call}. For work say "make" or "write"; for a device say something like "play kesariya on pc".`;
      }
    }
  } catch (e) {
    console.error(e);
    reply = hi ? `${call}, abhi thodi dikkat aayi, message save hai.` : `${call}, something went wrong; your message is saved.`;
  }

  await db.from("chat").insert({ role: "coco", author: "Coco", body: reply.slice(0, 800), reply_to: m.id, status: "answered", task_id: taskId, handled_by: "coco-cloud" });
  await db.from("chat").update({ status: "answered", task_id: taskId }).eq("id", m.id);
}

Deno.serve(async () => {
  // The trigger can fire a moment before the new row is visible, so look again for up to 3 seconds.
  let data: Msg[] | null = null;
  for (let i = 0; i < 6; i++) {
    ({ data } = await db.from("chat").select("id,author,body,device_id").eq("role", "founder").eq("status", "new").order("id").limit(10));
    if (data?.length) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const m of (data ?? []) as Msg[]) await handle(m);
  return new Response(JSON.stringify({ handled: data?.length ?? 0 }), { headers: { "content-type": "application/json" } });
});
