import { test, expect, type Page } from "@playwright/test";

const FIXTURE = "/tests/ui/fixtures/index.html";

test.describe("retro-controlpanel-card (UI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () => !!customElements.get("retro-controlpanel-card") &&
            !!document.querySelector("retro-controlpanel-card"),
    );
  });

  test("renders the panel chrome and title", async ({ page }) => {
    const card = page.locator("retro-controlpanel-card");
    await expect(card).toBeVisible();
    await expect(card.locator(".title")).toHaveText("Reactor Control");
    await expect(card.locator(".screw")).toHaveCount(4);
  });

  test("renders one of each control type", async ({ page }) => {
    const card = page.locator("retro-controlpanel-card");
    for (const tag of [
      "retro-seven-segment",
      "retro-vu-meter",
      "retro-flip-switch",
      "retro-gauge",
      "retro-button",
    ]) {
      await expect(card.locator(tag).first()).toBeVisible();
    }
  });

  test("flip switch toggles the entity on click", async ({ page }) => {
    const sw = page.locator("retro-flip-switch").first().locator(".row");
    await expect(sw).toHaveAttribute("aria-checked", "false");

    await sw.click();

    await expect(sw).toHaveAttribute("aria-checked", "true");
    expect(await readCalls(page)).toContainEqual(expect.objectContaining({
      domain: "homeassistant",
      service: "toggle",
      data: { entity_id: "input_boolean.toggle" },
    }));
  });

  test("input_button click fires input_button.press", async ({ page }) => {
    await page.locator("retro-button").first().locator("button.btn").click();
    expect(await readCalls(page)).toContainEqual(expect.objectContaining({
      domain: "input_button",
      service: "press",
      data: { entity_id: "input_button.fire" },
    }));
  });

  test("script button fires script.turn_on", async ({ page }) => {
    await page.locator("retro-button").nth(1).locator("button.btn").click();
    expect(await readCalls(page)).toContainEqual(expect.objectContaining({
      domain: "script",
      service: "turn_on",
      data: { entity_id: "script.launch" },
    }));
  });

  test("seven-segment display reflects the entity value", async ({ page }) => {
    const display = page.locator("retro-seven-segment").first();
    await expect(display.locator(".display")).toBeVisible();
    // 4 num_digits + 1 dp position → 4 .digit slots.
    await expect(display.locator(".digit")).toHaveCount(4);

    await page.evaluate(() => {
      const w = window as any;
      w.__retro.states["sensor.temperature_a"].state = "42.5";
      w.__retro.renderHass();
    });

    // After update, some segments should be lit (the .seg-on class is on SVG polygons).
    const litCount = await display.locator(".seg-on").count();
    expect(litCount).toBeGreaterThan(0);
  });

  test("vu meter lights the right number of segments", async ({ page }) => {
    // Default value = 55 of 100 over 10 segments → round(5.5) = 6 lit.
    await expect(
      page.locator("retro-vu-meter").first().locator(".seg.on"),
    ).toHaveCount(6);
  });

  test("switching theme via setConfig flips colour variables", async ({ page }) => {
    const amber = await primaryColor(page);
    await page.evaluate(() => (window as any).__retro.setConfig({ theme: "green" }));
    const green = await primaryColor(page);
    expect(amber).not.toBe(green);
  });

  test("switching to dymo labels renders the .label.dymo class", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({ label_style: "dymo" }));
    await expect(
      page.locator("retro-flip-switch").first().locator(".label.dymo").first(),
    ).toBeVisible();
  });

  test("flip switch toggles on Space keypress", async ({ page }) => {
    const sw = page.locator("retro-flip-switch").first().locator(".row");
    await sw.focus();
    await page.keyboard.press("Space");
    await expect(sw).toHaveAttribute("aria-checked", "true");
  });

  test("seven-segment unit is an etched label beside the display", async ({ page }) => {
    // Fixture's first seven-segment has unit °C; panel label style is etched.
    const unit = page.locator("retro-seven-segment").first().locator(".unit.etched");
    await expect(unit).toHaveText("°C");
  });

  test("vu meter shows an engraved scale when enabled", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "sensor.signal", type: "vu_meter", min: 0, max: 100, show_scale: true, scale_divisions: 4 },
      ] }],
    }));
    const nums = page.locator("retro-vu-meter").first().locator(".scale-num");
    await expect(nums).toHaveCount(5);
    await expect(nums.first()).toHaveText("0");
    await expect(nums.last()).toHaveText("100");
  });

  test("vu meter shows a tiny value readout when show_value is set", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "sensor.signal", type: "vu_meter", min: 0, max: 100, show_value: true },
      ] }],
    }));
    const mini = page.locator("retro-vu-meter").first().locator("retro-mini-segments");
    await expect(mini).toHaveCount(1);
    // 3 digit slots for a 0..100 range.
    await expect(mini.locator(".d")).toHaveCount(3);
  });

  test("gauge shows a tiny value readout when show_value is set", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "sensor.speed", type: "gauge", min: 0, max: 120, show_value: true },
      ] }],
    }));
    const mini = page.locator("retro-gauge").first().locator("retro-mini-segments");
    await expect(mini).toHaveCount(1);
    await expect(mini.locator(".d")).toHaveCount(3);
  });

  test("value_size overrides the readout font size", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "sensor.speed", type: "gauge", min: 0, max: 120, show_value: true, value_size: 1.4 },
      ] }],
    }));
    const fontSize = await page.locator("retro-gauge").first()
      .locator("retro-mini-segments")
      .evaluate((el) => getComputedStyle(el).fontSize);
    // 1.4em relative to the gauge's inherited font-size; just assert it took the
    // inline override (much larger than the unset ~0.5em default would be).
    expect(parseFloat(fontSize)).toBeGreaterThan(15);
  });

  test("gauge reads a climate attribute and lights the heating indicator", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as any;
      w.__retro.states["climate.valve"] = {
        entity_id: "climate.valve",
        state: "heat",
        attributes: { current_temperature: 19.5, hvac_action: "heating", friendly_name: "Valve" },
      };
      w.__retro.setConfig({ rows: [{ entities: [
        { entity: "climate.valve", type: "gauge", min: 0, max: 30, show_value: true, indicator: "red" },
      ] }] });
      w.__retro.renderHass();
    });
    const gauge = page.locator("retro-gauge").first();
    const ind = gauge.locator("retro-indicator");
    await expect(ind).toHaveCount(1);
    await expect(ind).toHaveJSProperty("on", true); // hvac_action = heating
    // The value readout renders (current_temperature 19.5 -> rounded by the mini).
    await expect(gauge.locator("retro-mini-segments")).toHaveCount(1);
  });

  test("flip switch shows a status indicator when configured", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "input_boolean.toggle", type: "flip_switch", indicator: "amber", indicator_position: "left" },
      ] }],
    }));
    const row = page.locator("retro-flip-switch").first().locator(".row");
    // Indicator on the left = first child of the row.
    await expect(row.locator("retro-indicator")).toBeVisible();
  });

  test("a table lines its cells up in columns under their headers", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [{
        type: "table",
        columns: [{ header: "°C", num_digits: 3 }, { header: "SPD", num_digits: 4 }],
        rows: [
          { label: "CABIN", cells: ["sensor.temperature_a", "sensor.speed"] },
          { label: "ENGINE ROOM", cells: ["sensor.temperature_b", "sensor.speed"] },
        ],
      }] }],
    }));
    const table = page.locator("retro-table");
    const cells = table.locator("retro-seven-segment");
    await expect(cells).toHaveCount(4);
    const centre = async (i: number) => {
      const b = (await cells.nth(i).boundingBox())!;
      return b.x + b.width / 2;
    };
    // Same column, same horizontal centre - even though the row labels differ in width.
    expect(Math.abs((await centre(0)) - (await centre(2)))).toBeLessThan(1);
    expect(Math.abs((await centre(1)) - (await centre(3)))).toBeLessThan(1);
    // And each header sits over its column.
    const header = (await table.locator(".header").nth(1).boundingBox())!;
    expect(Math.abs(header.x + header.width / 2 - (await centre(1)))).toBeLessThan(1);
  });

  test("table cells of every type drop their labels but keep their LEDs", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { type: "table", cell_type: "flip_switch", columns: [{ header: "PUMP", indicator: "green" }],
          rows: [{ label: "ZONE A", cells: ["input_boolean.toggle"] }] },
        { type: "table", cell_type: "button", columns: [{ header: "FIRE", text: "GO" }],
          rows: [{ label: "BAY 1", cells: ["input_button.fire"] }] },
        { type: "table", cell_type: "gauge", columns: [{ header: "SPD", indicator: "red" }, { header: "SIG" }],
          rows: [{ label: "ENGINE", cells: ["sensor.speed", "sensor.signal"] }] },
        { type: "table", cell_type: "vu_meter", rows: [{ label: "LEVEL", cells: ["sensor.signal"] }] },
        { type: "table", columns: [{ header: "°C", indicator: "amber" }],
          rows: [{ label: "CORE", cells: ["sensor.temperature_a"] }] },
      ] }],
    }));
    const tables = page.locator("retro-table");
    await expect(tables).toHaveCount(5);
    // No cell shows a label: the row label and header name it.
    const labels = tables.locator(
      "retro-flip-switch retro-label, retro-button retro-label, retro-gauge retro-label, " +
      "retro-vu-meter retro-label, retro-seven-segment retro-label",
    );
    for (const label of await labels.all()) await expect(label).toBeHidden();
    // But the LEDs stay: beside the switch, under the gauge, beside the display.
    await expect(tables.nth(0).locator("retro-flip-switch retro-indicator")).toBeVisible();
    await expect(tables.nth(2).locator("retro-gauge").nth(0).locator("retro-indicator")).toBeVisible();
    await expect(tables.nth(2).locator("retro-gauge").nth(1).locator(".label-row")).toBeHidden();
    await expect(tables.nth(4).locator("retro-seven-segment .display-row retro-indicator")).toBeVisible();
    // The button keeps the text on its face; the VU meter lies down.
    await expect(tables.nth(1).locator("retro-button .face")).toHaveText("GO");
    await expect(tables.nth(3).locator("retro-vu-meter .meter.horizontal")).toBeVisible();
  });

  test("a table can mix a row of switches with a row of buttons, and even out its columns", async ({ page }) => {
    const table = (equal: boolean) => ({
      type: "table",
      cell_type: "flip_switch",
      equal_columns: equal,
      columns: [{ header: "A" }, { header: "A MUCH LONGER HEADER" }, { header: "B" }],
      rows: [
        { cells: ["input_boolean.toggle", "input_boolean.toggle", "input_boolean.toggle"] },
        { type: "button", text: "GO", cells: ["input_button.fire", "script.launch", "input_button.fire"] },
      ],
    });
    await page.evaluate((tables) => (window as any).__retro.setConfig({
      rows: [{ entities: [tables[0]] }, { entities: [tables[1]] }],
    }), [table(false), table(true)]);
    const [uneven, even] = [page.locator("retro-table").nth(0), page.locator("retro-table").nth(1)];
    await expect(uneven.locator("retro-flip-switch")).toHaveCount(3);
    await expect(uneven.locator("retro-button")).toHaveCount(3);

    // The column widths the grid actually laid out.
    const widths = (t: typeof even) => t.locator(".table").evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(" ").map(parseFloat));
    // Sized to content, the long header's column is far wider than the others...
    const sized = await widths(uneven);
    expect(sized[1] - sized[0]).toBeGreaterThan(20);
    // ...with equal columns, every column is as wide as that widest one.
    const equal = await widths(even);
    expect(Math.max(...equal) - Math.min(...equal)).toBeLessThan(1);
    expect(Math.abs(equal[0] - sized[1])).toBeLessThan(1);
  });

  test("a table's group brackets span exactly their columns and rows", async ({ page }) => {
    const t = "sensor.temperature_a";
    await page.evaluate((t) => (window as any).__retro.setConfig({
      rows: [
        { entities: [{
          type: "table",
          columns: [
            { group: "LIVING", header: "A" }, { group: "LIVING", header: "B" },
            { group: "KITCHEN", header: "C" }, { header: "D" },
          ],
          rows: [{ label: "°C", cells: [t, t, t, t] }],
        }] },
        { entities: [{
          type: "table",
          columns: [{ header: "°C" }],
          rows: [
            { group: "LIVING", label: "A", cells: [t] },
            { group: "LIVING", label: "B", cells: [t] },
            { group: "LIVING", label: "C", cells: [t] },
            { label: "D", cells: [t] },
          ],
        }] },
      ],
    }), t);
    const [byColumn, byRow] = [page.locator("retro-table").nth(0), page.locator("retro-table").nth(1)];
    const box = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())!;

    // LIVING reaches from its first column to its second, and stops short of
    // KITCHEN's; nothing hangs over the ungrouped column.
    const cells = byColumn.locator("retro-seven-segment");
    const [a, b, c] = [await box(cells.nth(0)), await box(cells.nth(1)), await box(cells.nth(2))];
    const living = await box(byColumn.locator(".col-group").nth(0));
    expect(living.x).toBeLessThanOrEqual(a.x + 1);
    expect(living.x + living.width).toBeGreaterThanOrEqual(b.x + b.width - 1);
    expect(living.x + living.width).toBeLessThan(c.x);
    await expect(byColumn.locator(".col-group")).toHaveCount(2);
    // The bracket ends bend down towards the headers.
    const rule = await box(byColumn.locator(".col-group .rule.start").first());
    expect(rule.width).toBeGreaterThan(3);

    // The row bracket runs from the first row's top to the third's bottom,
    // not into the ungrouped fourth row.
    const rowsCells = byRow.locator("retro-seven-segment");
    const [first, third, fourth] = [await box(rowsCells.nth(0)), await box(rowsCells.nth(2)), await box(rowsCells.nth(3))];
    const brace = await box(byRow.locator(".row-group .brace"));
    expect(brace.y).toBeLessThanOrEqual(first.y + first.height / 2);
    expect(brace.y + brace.height).toBeGreaterThanOrEqual(third.y + third.height / 2);
    expect(brace.y + brace.height).toBeLessThan(fourth.y);
    // The group name sits left of the row labels.
    const name = await box(byRow.locator(".row-group retro-label"));
    const label = await box(byRow.locator(".row-label").first());
    expect(name.x + name.width).toBeLessThan(label.x);
  });

  test("a row's frame and its groups can fill the width, or hug their controls", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.evaluate(() => {
      const flip = { type: "flip_switch", entity: "input_boolean.toggle" };
      const group = (label: string, fill: boolean) =>
        ({ type: "group", group_style: "embossed", label, fill_width: fill, entities: [flip] });
      (window as any).__retro.setConfig({
        rows: [
          { group_style: "screwed", entities: [group("SNUG", false), group("SNUG", false)] },
          { group_style: "screwed", fill_width: true, entities: [group("WIDE", true), group("SNUG", false)] },
          { group_style: "screwed", fill_width: true, justify: "start", entities: [flip] },
        ],
      });
    });
    const card = page.locator("retro-controlpanel-card");
    const box = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())!;
    const rows = card.locator(".row");
    const frames = card.locator(".row > .row-group");
    await expect(frames).toHaveCount(3);
    const row = await box(rows.nth(0));

    // Without fill_width the frame hugs its two groups...
    const snug = await box(frames.nth(0));
    expect(snug.width).toBeLessThan(row.width * 0.6);
    // ...with it, the frame spans the row.
    const wide = await box(frames.nth(1));
    expect(Math.abs(wide.width - row.width)).toBeLessThan(1);

    // In the wide frame, the filling group takes all the room the other
    // group leaves; that one keeps its size.
    const inner = await box(frames.nth(1).locator("> .group-inner"));
    const [grown, kept] = [
      await box(frames.nth(1).locator(".cell.group-cell").nth(0)),
      await box(frames.nth(1).locator(".cell.group-cell").nth(1)),
    ];
    expect(grown.width).toBeGreaterThan(kept.width * 3);
    expect(kept.x + kept.width).toBeGreaterThan(inner.x + inner.width - 2);
    expect(Math.abs(kept.width - (await box(frames.nth(0).locator(".cell.group-cell").nth(0))).width)).toBeLessThan(1);

    // A filled frame has room to spare, and the row's justify places the
    // controls in it: start puts the switch at the frame's left edge.
    const startInner = await box(frames.nth(2).locator("> .group-inner"));
    const flipBox = await box(frames.nth(2).locator(".cell").first());
    expect(flipBox.x - startInner.x).toBeLessThan(2);
  });

  test("a group wraps its controls when the card is narrower than the group", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.evaluate(() => {
      const display = { entity: "sensor.temperature_a", type: "seven_segment", num_digits: 4 };
      (window as any).__retro.setConfig({
        rows: [{ group_style: "screwed", entities: [
          { type: "group", group_style: "embossed", label: "TIMES",
            entities: [display, display, display, display, display] },
        ] }],
      });
    });
    const card = page.locator("retro-controlpanel-card");
    const group = card.locator(".row-group.group-embossed");
    await expect(group.locator("retro-seven-segment")).toHaveCount(5);

    // The group stays inside the panel...
    const panel = (await card.locator(".panel-inner").boundingBox())!;
    const box = (await group.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    // ...because its displays wrapped onto more than one line.
    const tops = await group.locator("retro-seven-segment").evaluateAll(
      (els) => els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBeGreaterThan(1);
  });
});

// Separate suite: a touch-emulating context so we exercise the real
// touchend -> synthesized-click sequence that caused the double-toggle on
// mobile. The default project has no touch, so we make our own context.
test.describe("retro-controlpanel-card (touch)", () => {
  test("a single tap toggles the entity exactly once (no flicker)", async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto(FIXTURE);
      await page.waitForFunction(
        () => !!customElements.get("retro-controlpanel-card") &&
              !!document.querySelector("retro-controlpanel-card"),
      );
      const sw = page.locator("retro-flip-switch").first().locator(".row");
      await sw.tap();
      // Wait past the ghost-click window so a stray synthetic click would land.
      await page.waitForTimeout(900);
      const toggleCalls = await page.evaluate(() =>
        (window as any).__retro.calls.filter((c: any) => c.service === "toggle"),
      );
      expect(toggleCalls).toHaveLength(1);
    } finally {
      await context.close();
    }
  });
});

async function primaryColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const card = document.querySelector("retro-controlpanel-card") as HTMLElement;
    return getComputedStyle(card).getPropertyValue("--retro-primary").trim();
  });
}

async function readCalls(page: Page): Promise<Array<{ domain: string; service: string; data: any }>> {
  return page.evaluate(() => (window as any).__retro.calls);
}
