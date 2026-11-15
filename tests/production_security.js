const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "familyhubs-test-"));
process.env.DB_PATH = path.join(dir, "test.db");
const data = require("../server/db");
data.initDatabase();
const db = data.db;
db.prepare("INSERT INTO users (id,role,email,phone,full_name) VALUES ('admin-fixture','ADMIN','admin@familyhubs.in','1234567890','Operations fixture')").run();
const tokens = {};
for (const [id, role] of [
  ["client-a", "CLIENT"],
  ["client-b", "CLIENT"],
  ["partner-a", "PARTNER"],
]) {
  db.prepare(
    "INSERT INTO users (id,role,email,phone,full_name) VALUES (?,?,?,?,?)",
  ).run(id, role, `${id}@example.com`, "1234567890", id);
  if (role === "CLIENT")
    db.prepare(
      "INSERT INTO clients_profile (user_id,country_residence) VALUES (?, 'India')",
    ).run(id);
  else
    db.prepare(
      "INSERT INTO partners_profile (user_id,service_category,operating_region,kyc_verified,is_active) VALUES (?, 'ERRANDS','Test',1,1)",
    ).run(id);
}
db.exec(
  "CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL)",
);
for (const id of [
  "client-a",
  "client-b",
  "partner-a",
  db.prepare("SELECT id FROM users WHERE role='ADMIN'").get().id,
]) {
  const token = crypto.randomBytes(32).toString("hex");
  tokens[id] = `fh_session=${token}`;
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    crypto.createHash("sha256").update(token).digest("hex"),
    id,
    Date.now() + 3600000,
  );
}
const admin =
  tokens[db.prepare("SELECT id FROM users WHERE role='ADMIN'").get().id];
const parent = data.createParent({
  clientId: "client-a",
  parentName: "Test parent",
  primaryPhone: "1234567890",
  locality: "Test city",
  fullAddress: "Test address",
  coordinatesLat: 17,
  coordinatesLng: 78,
});
const task = data.createTask({
  clientId: "client-a",
  parentId: parent.id,
  category: "ERRANDS",
  title: "Fixture request",
  instructions: "Test",
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  escrowAmount: 0,
});
let checks = 0;
const port = 14000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server/server.js"], {
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    PORT: String(port),
    CORS_ORIGIN: base,
    UPLOAD_DIR: path.join(dir, "uploads"),
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    WHATSAPP_ACCESS_TOKEN: "",
    WHATSAPP_APP_SECRET: "test-app-secret",
    RESET_DB_ON_START: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (d) => (logs += d));
child.stderr.on("data", (d) => (logs += d));
async function request(route, cookie, body, method) {
  const r = await fetch(base + route, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
  console.log(`PASS ${message}`);
}
(async () => {
  try {
    for (let i = 0; i < 80; i++) {
      try {
        await fetch(base + "/api/health");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    check(
      (await request("/api/tasks")).status,
      401,
      "anonymous requests are blocked",
    );
    check(
      (await request("/api/security/reset-clean")).status,
      401,
      "anonymous reset is blocked",
    );
    check(
      (await request("/api/security/reset-clean", admin, {})).status,
      410,
      "remote reset is removed",
    );
    check(
      (
        await request("/api/auth/login", null, {
          email: "admin@familyhubs.in",
          password: "Admin@FamilyHubs2026!",
          role: "ADMIN",
        })
      ).status,
      503,
      "auth fails closed without provider",
    );
    check(
      (await request("/api/auth/otp/send", null, { email: "a@example.com" }))
        .status,
      503,
      "legacy debug OTP cannot be used",
    );
    check(
      (await request("/api/tasks?clientId=client-a", tokens["client-b"])).data
        .length,
      0,
      "client cannot change scope using query parameters",
    );
    check(
      (await request(`/api/tasks/${task.id}`, tokens["client-b"])).status,
      403,
      "task details isolated",
    );
    check(
      (
        await request(
          `/api/parents/${parent.id}`,
          tokens["client-b"],
          {},
          "DELETE",
        )
      ).status,
      403,
      "parent deletion isolated",
    );
    check(
      (await request(`/api/parents/${parent.id}/vitals`, tokens["client-b"]))
        .status,
      403,
      "medical history isolated",
    );
    check(
      (await request("/api/security/settings", tokens["client-a"])).status,
      403,
      "settings restricted to operations",
    );
    check(
      "escrow_release_pin" in
        (await request("/api/security/settings", admin)).data,
      false,
      "PIN never returned",
    );
    check(
      (
        await request("/api/tasks", tokens["client-b"], {
          parentId: parent.id,
          category: "ERRANDS",
          title: "Unauthorized",
          instructions: "Test",
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        })
      ).status,
      400,
      "booking for another family blocked",
    );
    check(
      (
        await request("/api/parents", tokens["client-a"], {
          parentName: "Invalid",
        })
      ).status,
      400,
      "incomplete parent data rejected",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/assign`, tokens["client-a"], {
          partnerId: "partner-a",
        })
      ).status,
      403,
      "client cannot dispatch",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/assign`, admin, {
          partnerId: "partner-a",
        })
      ).status,
      200,
      "operations dispatch works",
    );
    check(
      (await request(`/api/tasks/${task.id}/accept`, tokens["partner-a"], {}))
        .status,
      200,
      "assigned partner can accept",
    );
    check(
      (await request(`/api/tasks/${task.id}/accept`, tokens["partner-a"], {}))
        .status,
      409,
      "task stage replay blocked",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/verify`, tokens["partner-a"], {
          stage: "TASK_COMPLETION",
          selfieImageUrl: "https://example.com/fake.jpg",
          latitude: 17,
          longitude: 78,
        })
      ).status,
      409,
      "completion cannot precede arrival",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/verify`, tokens["partner-a"], {
          stage: "ARRIVAL_CHECKIN",
          selfieImageUrl: "https://example.com/fake.jpg",
          latitude: 17,
          longitude: 78,
        })
      ).status,
      403,
      "unowned proof rejected",
    );
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    check(
      (
        await request("/api/upload", tokens["partner-a"], {
          imageBase64: "data:image/jpeg;base64,SGVsbG8=",
        })
      ).status,
      400,
      "disguised non-image upload rejected",
    );
    const upload = await request("/api/upload", tokens["partner-a"], {
      imageBase64: image,
    });
    check(upload.status, 200, "private proof upload works");
    check(
      (
        await fetch(base + upload.data.imageUrl, {
          headers: { Cookie: tokens["client-b"] },
        })
      ).status,
      403,
      "unrelated family cannot read uploaded proof",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/verify`, tokens["partner-a"], {
          stage: "ARRIVAL_CHECKIN",
          selfieImageUrl: upload.data.imageUrl,
          latitude: 0,
          longitude: 0,
        })
      ).data.status,
      "ACCEPTED",
      "out-of-bounds proof cannot advance visit",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/verify`, tokens["partner-a"], {
          stage: "ARRIVAL_CHECKIN",
          selfieImageUrl: upload.data.imageUrl,
          latitude: 17,
          longitude: 78,
        })
      ).data.status,
      "IN_PROGRESS",
      "real arrival coordinates advance visit",
    );
    check(
      (
        await fetch(base + upload.data.imageUrl, {
          headers: { Cookie: tokens["client-a"] },
        })
      ).status,
      200,
      "owning family can view shared proof",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/verify`, tokens["partner-a"], {
          stage: "TASK_COMPLETION",
          selfieImageUrl: upload.data.imageUrl,
          latitude: 17,
          longitude: 78,
        })
      ).data.status,
      "VERIFICATION_SUBMITTED",
      "completion proof submitted",
    );
    check(
      (await request(`/api/tasks/${task.id}/complete`, admin, {})).data.status,
      "COMPLETED",
      "operations can complete a verified visit",
    );
    check(
      (await request(`/api/tasks/${task.id}/complete`, admin, {})).status,
      409,
      "completion replay blocked",
    );
    check(
      (await request("/api/parents?clientId=client-a", tokens["partner-a"]))
        .status,
      403,
      "partner cannot enumerate unrelated parent profiles",
    );
    check(
      (
        await request(
          "/api/parents/" + parent.id + "/vitals",
          tokens["client-a"],
          { bloodPressureSys: 120, bloodPressureDia: 80, pulse: 72, spo2: 98 },
        )
      ).status,
      201,
      "real health reading saves",
    );
    check(
      (
        await request(
          "/api/parents/" + parent.id + "/vitals",
          tokens["client-a"],
        )
      ).data.length,
      1,
      "health reading persists",
    );
    check(
      (
        await request(
          "/api/parents/" + parent.id + "/vitals",
          tokens["client-a"],
          { spo2: 200 },
        )
      ).status,
      400,
      "invalid health values rejected",
    );
    check(
      (
        await request(
          "/api/parents/" + parent.id + "/medications",
          tokens["client-a"],
          {
            medicineName: "Test prescription",
            dosage: "As prescribed",
            frequency: "Daily",
          },
        )
      ).status,
      201,
      "medication saves",
    );
    check(
      (
        await request(
          "/api/parents/" + parent.id + "/documents",
          tokens["client-a"],
          {
            title: "Test reference",
            fileUrl: "https://example.com/private",
            category: "OTHER",
          },
        )
      ).status,
      201,
      "document saves",
    );
    check(
      (
        await request("/api/emergency/sos", tokens["client-a"], {
          parentId: parent.id,
          notes: "Fixture alert",
        })
      ).status,
      201,
      "care alert saves",
    );
    check(
      db.prepare("SELECT count(*) AS n FROM escrow_transactions").get().n,
      0,
      "no simulated escrow is created",
    );
    check(
      (
        await request(`/api/tasks/${task.id}/escrow/approve`, admin, {
          pin: "849201",
        })
      ).status,
      503,
      "unconfigured money transfers cannot be reported as successful",
    );
    const before = await request("/api/auth/me", tokens["client-a"]);
    check((await request('/api/partners/partner-a/location',tokens['client-a'])).status,403,'completed visits do not expose ongoing partner GPS');
    check((await request('/api/not-a-real-endpoint', tokens['client-a'])).status,404,'unknown API endpoints return 404');
    check((await request(`/api/parents/${parent.id}`,tokens['client-a'],{},'DELETE')).status,409,'parent visit history produces a useful conflict');
    check((await request(`/api/parents/${parent.id}/vitals`,tokens['client-a'],{})).status,400,'empty health readings rejected');
    check((await request(`/api/parents/${parent.id}/vitals`,tokens['client-a'],{bloodSugar:-1})).status,400,'invalid blood sugar rejected');
    check((await request(`/api/parents/${parent.id}/medications`,tokens['client-a'],{medicineName:'Fixture',dosage:'As prescribed',frequency:'Daily',stockRemaining:-1})).status,400,'negative medication stock rejected');
    check((await request(`/api/parents/${parent.id}/documents`,tokens['client-a'],{title:'Fixture',fileUrl:'https://example.com/private',category:'INVALID'})).status,400,'invalid document categories rejected');
    check((await request(`/api/parents/${parent.id}/medications/missing/refill`,admin,{})).status,404,'missing medication cannot create a fabricated refill');
    const adminReading=await request(`/api/parents/${parent.id}/vitals`,admin,{pulse:70,recordedBy:'client-b'});
    check(adminReading.status,201,'operations can record a real measurement');
    check(db.prepare('SELECT recorded_by FROM parent_vitals WHERE id=?').get(adminReading.data.id).recorded_by,db.prepare("SELECT id FROM users WHERE role='ADMIN'").get().id,'operations health attribution uses the signed-in account');
    let meStatus=200;
    for(let i=0;i<24;i++) meStatus=(await request('/api/auth/me',tokens['client-a'])).status;
    check(meStatus,200,'session checks do not exhaust login rate limits');
    check(before.data.user.id, "client-a", "session resolves server identity");
    await request("/api/auth/logout", tokens["client-a"], {});
    check(
      (await request("/api/auth/me", tokens["client-a"])).status,
      401,
      "logout revokes server session",
    );
    const feedback=await request(`/api/tasks/${task.id}/review`,tokens['client-b'],{rating:5,taskId:task.id});
  check(feedback.status,403,'another family cannot submit a task review');
  console.log(`${checks} security and functional checks passed.`);
    await require("./whatsapp_delivery")({ db, parent, base });
    if (process.env.UI_TEST === "true")
      await require("./production_ui")({ base, tokens, admin, db });
  } catch (e) {
    console.error(e);
    console.error(logs.slice(-3000));
    process.exitCode = 1;
  } finally {
    child.kill();
    db.close();
  }
})();
