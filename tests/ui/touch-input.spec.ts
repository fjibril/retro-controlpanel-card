import { test, expect, type CDPSession, type Locator, type Page } from "@playwright/test";

/**
 * Touch input the way a remote display drives a headless browser (e.g.
 * RemoteWebView on an ESP32 panel): genuine CDP touch events and mobile
 * device metrics, but no touch emulation - so the page does not advertise
 * touch support, and the browser only turns a touch into a click when the
 * finger barely moves.
 */

const FIXTURE = "/tests/ui/fixtures/index.html";

async function open(page: Page, emulateTouch: boolean): Promise<CDPSession> {
  await page.goto(FIXTURE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 480, height: 480, deviceScaleFactor: 1, mobile: true });
  if (emulateTouch) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await page.reload();
  await page.waitForFunction(
    () => !!(window as any).__retro && !!document.querySelector("retro-controlpanel-card"),
  );
  await page.evaluate(() => {
    const w = window as any;
    w.__moreInfo = 0;
    document.addEventListener("hass-more-info", () => { w.__moreInfo++; });
  });
  return cdp;
}

/** Finger down on the element's centre, optionally slide `dragPx` sideways, hold, lift. */
async function press(
  page: Page, cdp: CDPSession, target: Locator,
  { holdMs = 100, dragPx = 0 }: { holdMs?: number; dragPx?: number } = {},
) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const point = (dx: number) => [{ x: x + dx, y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
  await page.evaluate(() => {
    const w = window as any;
    w.__retro.calls.length = 0;
    w.__moreInfo = 0;
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
  if (dragPx) {
    for (let step = 1; step <= 6; step++) {
      await page.waitForTimeout(15);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point((dragPx * step) / 6) });
    }
  }
  await page.waitForTimeout(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // Past the window in which a late browser-made click would be swallowed.
  await page.waitForTimeout(900);
  return page.evaluate(() => ({
    calls: ((window as any).__retro.calls as Array<{ domain: string; service: string }>)
      .map((c) => `${c.domain}.${c.service}`),
    moreInfo: (window as any).__moreInfo as number,
  }));
}

test.describe("touch input from a remote display (no touch emulation)", () => {
  const targets = {
    switch: { locate: (p: Page) => p.locator("retro-flip-switch").first().locator(".row"), call: "homeassistant.toggle" },
    button: { locate: (p: Page) => p.locator("retro-button").first().locator("button.btn"), call: "input_button.press" },
  };

  for (const [name, t] of Object.entries(targets)) {
    test(`a tap on the ${name} runs its action once`, async ({ page }) => {
      const cdp = await open(page, false);
      expect(await press(page, cdp, t.locate(page))).toEqual({ calls: [t.call], moreInfo: 0 });
    });

    test(`a tap on the ${name} survives a 20px finger roll`, async ({ page }) => {
      // The browser alone drops the click past ~15px of movement.
      const cdp = await open(page, false);
      expect(await press(page, cdp, t.locate(page), { dragPx: 20 })).toEqual({ calls: [t.call], moreInfo: 0 });
    });

    test(`a long press on the ${name} opens more-info instead`, async ({ page }) => {
      const cdp = await open(page, false);
      expect(await press(page, cdp, t.locate(page), { holdMs: 800 })).toEqual({ calls: [], moreInfo: 1 });
    });

    test(`dragging across the ${name} does nothing`, async ({ page }) => {
      const cdp = await open(page, false);
      expect(await press(page, cdp, t.locate(page), { dragPx: 60 })).toEqual({ calls: [], moreInfo: 0 });
    });
  }

  test("with touch emulation on, dragging across a button does nothing either", async ({ page }) => {
    const cdp = await open(page, true);
    const button = targets.button.locate(page);
    expect(await press(page, cdp, button, { dragPx: 60 })).toEqual({ calls: [], moreInfo: 0 });
    expect(await press(page, cdp, button)).toEqual({ calls: ["input_button.press"], moreInfo: 0 });
  });
});
