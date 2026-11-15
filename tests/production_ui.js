const { chromium, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
module.exports = async ({ base, tokens, admin, db }) => {
  const browser = await chromium.launch({ channel: "chromium" });
  const out = path.join(__dirname, "../artifacts/ui");
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const [name, route, cookie] of [
      ["family", "/", tokens["client-b"]],
      ["operations", "/ops/", admin],
      ["partner", "/partner/", tokens["partner-a"]],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      let failures = [];
      page.on("pageerror", (e) => failures.push(e.message));
      await page.goto(base + route);
      await expect(
        page.getByRole("heading", { name: "Welcome back." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue with Google" }).click();
      await expect(page.getByRole("alert")).toContainText(
        "Authentication is not configured.",
      );
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeEnabled();
      await page.screenshot({
        path: path.join(out, `${name}-signin.png`),
        fullPage: true,
      });
      await context.addCookies([
        {
          name: "fh_session",
          value: cookie.split("=")[1],
          url: base,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name:
            name === "family"
              ? "Your family, cared for."
              : name === "operations"
                ? "Care, coordinated."
                : "Make care personal.",
        }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(out, `${name}-desktop.png`),
        fullPage: true,
      });
      if (name === "family") {
        // A family with no profiles must be guided into onboarding, not an empty booking form.
        await page.getByRole('button',{name:'Request care',exact:true}).click();
        await expect(page.getByRole('heading',{name:'Add a parent',exact:true})).toBeVisible();
        await page.getByRole('button',{name:'Close dialog'}).click();
        await page
          .getByRole("button", { name: "My parents", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Add your first parent" })
          .click();
        await page.getByLabel("Parent’s full name").fill("UI Test Parent");
        await page
          .getByLabel("Phone number", { exact: true })
          .fill("1234567890");
        await page.getByLabel("City / locality").fill("Test City");
        await page.getByLabel("Full home address").fill("Test Home");
        await page.getByLabel("Home latitude").fill("17");
        await page.getByLabel("Home longitude").fill("78");
        await page.getByRole("button", { name: "Save & continue" }).click();
        await expect(
          page.getByRole("heading", { name: "UI Test Parent" }),
        ).toBeVisible();
        // Parent screen uses Add parent; navigate to care requests for booking.
        await page
          .getByRole("button", { name: "Care requests", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Request care", exact: true })
          .click();
        await page
          .locator("select[name=parentId]")
          .selectOption({ label: "UI Test Parent" });
        await page
          .getByLabel("What support is needed?")
          .fill("Pharmacy pickup");
        await page
          .getByLabel("Preferred date and time")
          .fill("2027-01-15T10:00");
        await page
          .getByLabel("Details for your care team")
          .fill("Collect prescription from the local pharmacy.");
        await page.getByRole("button", { name: "Send care request" }).click();
        await expect(
          page.getByRole("heading", { name: "Pharmacy pickup" }),
        ).toBeVisible();
        await page.getByRole('button',{name:'Health records',exact:true}).click();
        await expect(page.getByRole('heading',{name:'No readings recorded'})).toBeVisible();
        for(const notes of ['First repeat-save fixture','Second repeat-save fixture']) {
          await page.getByRole('button',{name:'Add reading',exact:true}).click();
          for(const [label,value] of [['Systolic (mmHg)','120'],['Diastolic (mmHg)','80'],['Pulse (bpm)','72'],['SpO₂ (%)','98']]) await page.getByLabel(label,{exact:true}).fill(value);
          await page.getByLabel('Notes',{exact:true}).fill(notes);
          await page.getByRole('button',{name:'Save & continue'}).click();
          await expect(page.getByText(notes,{exact:true})).toBeVisible();
        }
        // A slow previous-parent request must never overwrite the newly selected parent's records.
        const profile=db.prepare("SELECT * FROM parents_profile WHERE parent_name='UI Test Parent'").get();
        const secondId=crypto.randomUUID();
        db.prepare("INSERT INTO parents_profile (id,client_id,parent_name,primary_phone,locality,full_address,coordinates_lat,coordinates_lng) VALUES (?,?,?,?,?,?,?,?)").run(secondId,profile.client_id,'Second UI QA parent','1234567890','Test City','Test Home',17,78);
        await page.route(`**/api/parents/${profile.id}/vitals`,async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({json:[{id:'delayed',blood_pressure_sys:121,blood_pressure_dia:81,notes:'Delayed previous parent reading',recorded_at:new Date().toISOString()}]})});
        await page.getByRole('button',{name:'Refresh records'}).click();
        await expect(page.getByLabel('Parent',{exact:true}).locator('option').filter({hasText:'Second UI QA parent'})).toHaveCount(1);
        await page.getByLabel('Parent',{exact:true}).selectOption(secondId);
        await expect(page.getByRole('heading',{name:'No readings recorded'})).toBeVisible();
        await page.waitForTimeout(800);
        await expect(page.getByText('Delayed previous parent reading',{exact:true})).toHaveCount(0);
        await page.unroute(`**/api/parents/${profile.id}/vitals`);
        // Track dialog has a close action, not a save button for a read-only position.
        const booking=db.prepare("SELECT id FROM tasks WHERE client_id='client-b'").get();
        db.prepare("UPDATE tasks SET assigned_partner_id='partner-a',status='ACCEPTED' WHERE id=?").run(booking.id);
        await page.getByRole('button',{name:'Refresh records'}).click();
        await page.getByRole('button',{name:'Care requests',exact:true}).click();
        await page.getByRole('button',{name:'Partner location',exact:true}).click();
        await expect(page.getByRole('dialog').getByRole('button',{name:'Save & continue'})).toHaveCount(0);
        await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      }
      if(name==='partner') {
        // Verify the UI chooses the only valid stage at each point of a visit.
        const seed=db.prepare("SELECT * FROM tasks LIMIT 1").get();
        const longTitle='UI QA long request '+ 'care coordination '.repeat(12);
        const ids=[];
        for(const status of ['ACCEPTED','IN_PROGRESS']) {
          const id=crypto.randomUUID();ids.push(id);
          db.prepare("INSERT INTO tasks (id,tracking_code,client_id,parent_id,assigned_partner_id,category,title,instructions,status,scheduled_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id,'UI-'+id.slice(0,8),seed.client_id,seed.parent_id,'partner-a','ERRANDS',status==='ACCEPTED'?'UI QA arrival request':longTitle,'UI QA visit instructions',status,new Date().toISOString());
        }
        await page.getByRole('button',{name:'Refresh records'}).click();
        await page.getByRole('button',{name:'My assignments',exact:true}).click();
        for(const [title,stage] of [['UI QA arrival request','ARRIVAL_CHECKIN'],[longTitle,'TASK_COMPLETION']]) {
          const row=page.locator('.task-row').filter({has:page.getByRole('heading',{name:title,exact:true})});
          await row.getByRole('button',{name:'Submit visit proof'}).click();
          await expect(page.getByLabel('Visit stage')).toHaveValue(stage);
          await expect(page.getByLabel('Visit stage').locator('option')).toHaveCount(1);
          await page.screenshot({path:path.join(out,`partner-${stage.toLowerCase()}-dialog.png`),fullPage:true});
          await page.getByRole('button',{name:'Close dialog'}).click();
        }
      }
      if (name === "operations") {
        const seed=db.prepare("SELECT * FROM tasks LIMIT 1").get();
        const taskId=crypto.randomUUID(),proofId=crypto.randomUUID();
        db.prepare("INSERT INTO tasks (id,tracking_code,client_id,parent_id,assigned_partner_id,category,title,instructions,status,scheduled_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(taskId,'UI-'+taskId.slice(0,8),seed.client_id,seed.parent_id,'partner-a','ERRANDS','UI QA proof review','Review completion evidence','VERIFICATION_SUBMITTED',new Date().toISOString());
        db.prepare("INSERT INTO verification_logs (id,task_id,partner_id,stage,selfie_image_url,latitude,longitude,distance_from_target_meters,timestamp,review_status,geofence_passed) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(proofId,taskId,'partner-a','TASK_COMPLETION','/uploads/ui-proof.png',17,78,2,new Date().toISOString(),'PENDING',1);
        await page.getByRole('button',{name:'Refresh records'}).click();
        await page.getByRole('button',{name:'Dispatch desk',exact:true}).click();
        const review=page.locator('.task-row').filter({has:page.getByRole('heading',{name:'UI QA proof review',exact:true})});
        await review.getByRole('button',{name:'Request new proof',exact:true}).click();
        await expect(page.getByRole('heading',{name:'Request new completion proof'})).toBeVisible();
        await expect(page.getByLabel('Reason for requesting new proof')).toHaveAttribute('required','');
        await page.getByRole('dialog').getByRole('button',{name:'Request new proof',exact:true}).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByLabel('Reason for requesting new proof').fill('UI QA: completion photo is unclear; please retake it.');
        await page.getByRole('dialog').getByRole('button',{name:'Request new proof',exact:true}).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(review.locator('.status')).toHaveText('In progress');
        expect(db.prepare('SELECT review_status FROM verification_logs WHERE id=?').get(proofId).review_status).toBe('REJECTED');
        await page
          .getByRole("button", { name: "Care partners", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Review verification" })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Close dialog" }).click();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await expect(page.locator('.workspace')).toHaveAttribute('inert','');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button',{name:'Toggle navigation'})).toBeFocused();
      await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error(`${name}: horizontal mobile overflow`);
      await page.screenshot({
        path: path.join(out, `${name}-mobile.png`),
        fullPage: true,
      });
      await page.setViewportSize({width:320,height:740});
      await page.getByRole('button',{name:'Toggle navigation'}).click();
      await page.getByRole('button',{name:name==='partner'?'My assignments':name==='operations'?'Dispatch desk':'Care requests',exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:path.join(out,`${name}-narrow-320.png`),fullPage:true});
      if (failures.length) throw Error(failures.join("\n"));
      console.log(
        `PASS ${name}: desktop/mobile, session restoration, navigation, no runtime errors`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
