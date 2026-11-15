const crypto = require("crypto");
const {
  db
} = require("./db");
function configured() {
  return Boolean(process.env.WHATSAPP_AUTOMATIC_ENABLED === "true" && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || ""));
}
async function init() {
  for (const sql of ["ALTER TABLE parents_profile ADD COLUMN whatsapp_consent INTEGER NOT NULL DEFAULT 0", "ALTER TABLE whatsapp_logs ADD COLUMN provider_message_id TEXT", "ALTER TABLE whatsapp_logs ADD COLUMN error_code TEXT"]) try {
    await db.exec(sql);
  } catch (e) {
    if (e.code !== '42701' && !e.message.includes("duplicate column")) throw e;
  }
  // Interrupted/ambiguous requests require manual review to avoid duplicate delivery.
  await db.prepare("UPDATE whatsapp_logs SET status='FAILED',error_code='DELIVERY_UNCONFIRMED' WHERE error_code='SENDING'").run();
}
function installWebhook(app, express) {
  app.get("/api/whatsapp/webhook", (req, res) => {
    if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query["hub.mode"] !== "subscribe" || req.query["hub.verify_token"] !== process.env.WHATSAPP_VERIFY_TOKEN) return res.sendStatus(403);
    res.status(200).send(req.query["hub.challenge"]);
  });
  app.post("/api/whatsapp/webhook", express.raw({
    type: "application/json",
    limit: "256kb"
  }), async (req, res) => {
    if (!process.env.WHATSAPP_APP_SECRET || !Buffer.isBuffer(req.body)) return res.sendStatus(403);
    const signature = req.get("x-hub-signature-256") || "";
    const expected = "sha256=" + crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(req.body).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.sendStatus(403);
    try {
      const event = JSON.parse(req.body);
      for (const entry of event.entry || []) for (const change of entry.changes || []) for (const item of change.value?.statuses || []) {
        const status = {
          sent: "SENT",
          delivered: "DELIVERED",
          read: "READ",
          failed: "FAILED"
        }[item.status];
        if (!status) continue;
        const current = await db.prepare("SELECT status FROM whatsapp_logs WHERE provider_message_id=?").get(item.id);
        const order = {
          QUEUED: 0,
          SENT: 1,
          DELIVERED: 2,
          READ: 3,
          FAILED: 4
        };
        if (current && (status === "FAILED" || order[status] >= order[current.status])) await db.prepare("UPDATE whatsapp_logs SET status=?,error_code=? WHERE provider_message_id=?").run(status, item.errors?.[0]?.code ? String(item.errors[0].code) : null, item.id);
      }
      res.sendStatus(200);
    } catch {
      res.sendStatus(400);
    }
  });
}
let running = false;
async function deliverQueued() {
  if (running || !configured()) return;
  running = true;
  try {
    const logs = await db.prepare("SELECT w.*,t.tracking_code,p.whatsapp_phone,p.whatsapp_consent FROM whatsapp_logs w JOIN tasks t ON t.id=w.task_id JOIN parents_profile p ON p.id=t.parent_id WHERE w.status='QUEUED' AND COALESCE(w.error_code,'')!='SENDING' LIMIT 10").all();
    for (const log of logs) {
      if (!log.whatsapp_consent) {
        await db.prepare("UPDATE whatsapp_logs SET status='FAILED',error_code='CONSENT_REQUIRED' WHERE id=?").run(log.id);
        continue;
      }
      const to = (log.whatsapp_phone || log.recipient_phone || "").replace(/[^\d]/g, "");
      if (!/^\d{10,15}$/.test(to)) {
        await db.prepare("UPDATE whatsapp_logs SET status='FAILED',error_code='INVALID_PHONE' WHERE id=?").run(log.id);
        continue;
      }
      await db.prepare("UPDATE whatsapp_logs SET error_code='SENDING' WHERE id=?").run(log.id);
      try {
        const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: process.env.WHATSAPP_TEMPLATE_NAME,
              language: {
                code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"
              },
              components: [{
                type: "body",
                parameters: [{
                  type: "text",
                  text: `${log.tracking_code}: ${log.template_name.replaceAll("_", " ")}`
                }]
              }]
            }
          })
        });
        const result = await response.json();
        if (!response.ok || !result.messages?.[0]?.id) throw Error(String(result.error?.code || "PROVIDER_REJECTED"));
        await db.prepare("UPDATE whatsapp_logs SET status='SENT',provider_message_id=?,error_code=NULL WHERE id=?").run(result.messages[0].id, log.id);
      } catch (error) {
        await db.prepare("UPDATE whatsapp_logs SET status='FAILED',error_code=? WHERE id=?").run(/^\d+$/.test(error.message) ? error.message : "DELIVERY_UNCONFIRMED", log.id);
      }
    }
  } finally {
    running = false;
  }
}
async function start() {
  await init();
  const timer = setInterval(() => deliverQueued().catch(() => console.error("[WHATSAPP] Queue processing failed.")), 5000);
  timer.unref();
  return timer;
}
module.exports = {
  init,
  start,
  configured,
  deliverQueued,
  installWebhook
};
