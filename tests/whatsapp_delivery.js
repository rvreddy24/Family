const assert = require("node:assert/strict");
module.exports = async ({ db, parent, base }) => {
  const wa = require("../server/whatsapp");
  wa.init();
  const saved = { ...process.env };
  const original = global.fetch;
  let sent = 0;
  try {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
    process.env.WHATSAPP_TEMPLATE_NAME = "care_update";
    process.env.WHATSAPP_GRAPH_VERSION = "v27.0";
    global.fetch = async (url, options) => {
      assert.match(
        url,
        /^https:\/\/graph.facebook.com\/v27.0\/12345\/messages$/,
      );
      const body = JSON.parse(options.body);
      assert.equal(body.type, "template");
      assert.equal(body.template.components[0].parameters.length, 1);
      assert.ok(!JSON.stringify(body).includes("Test parent"));
      return {
        ok: true,
        json: async () => ({ messages: [{ id: `test-message-${++sent}` }] }),
      };
    };
    await wa.deliverQueued();
    assert.equal(sent, 0, "no message sent without consent");
    db.prepare(
      "UPDATE parents_profile SET whatsapp_consent=1,whatsapp_phone=? WHERE id=?",
    ).run("+919999999999", parent.id);
    db.prepare(
      "UPDATE whatsapp_logs SET status='QUEUED',error_code=NULL WHERE task_id IN (SELECT id FROM tasks WHERE parent_id=?)",
    ).run(parent.id);
    await wa.deliverQueued();
    assert.ok(sent > 0);
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM whatsapp_logs WHERE status='SENT'")
        .get().n,
      sent,
    );
    global.fetch = original;
    const event = JSON.stringify({
      entry: [
        {
          changes: [
            { value: { statuses: [{ id: "test-message-1", status: "read" }] } },
          ],
        },
      ],
    });
    const invalid = await original(base + "/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "invalid",
      },
      body: event,
    });
    assert.equal(invalid.status, 403);
    const signature =
      "sha256=" +
      require("crypto")
        .createHmac("sha256", "test-app-secret")
        .update(event)
        .digest("hex");
    const valid = await original(base + "/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: event,
    });
    assert.equal(valid.status, 200);
    assert.equal(
      db
        .prepare("SELECT status FROM whatsapp_logs WHERE provider_message_id=?")
        .get("test-message-1").status,
      "READ",
    );
    console.log(
      "PASS WhatsApp: consent, approved template payload, truthful provider status, signed webhook, forged webhook rejection (mock provider; no messages sent).",
    );
  } finally {
    global.fetch = original;
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
};
