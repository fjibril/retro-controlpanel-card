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

  test("flip switch shows a status indicator when configured", async ({ page }) => {
    await page.evaluate(() => (window as any).__retro.setConfig({
      rows: [{ entities: [
        { entity: "input_boolean.toggle", type: "flip_switch", indicator: "amber", indicator_position: "left" },
      ] }],
    }));
    const row = page.locator("retro-flip-switch").first().locator(".row");
    // Indicator on the left = first child of the row.
    await expect(row.locator(".indicator")).toBeVisible();
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
