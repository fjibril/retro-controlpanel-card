import { test } from "@playwright/test";

/**
 * Not an assertion suite - this renders the card with a representative config
 * in each theme and writes a PNG to `screenshots/<theme>.png`. The Dockerfile's
 * `screenshots` target copies those out (see docker/build.ps1 -Target shots).
 * It doubles as a smoke test that every theme renders without throwing.
 */

const THEMES = ["amber", "green", "aluminium", "red"] as const;

const CONFIG = {
  type: "custom:retro-controlpanel-card",
  title: "RETRO CONTROL PANEL",
  title_style: "dymo",
  scale: 1,
  rows: [
    {
      entities: [
        { entity: "input_boolean.toggle", type: "flip_switch", indicator: "blue", indicator_position: "left", label: "POWER" },
        { entity: "input_boolean.toggle", type: "button", color: "blue", text: "FIRE", label: "ARM" },
        { entity: "script.launch", type: "button", color: "green", text: "RUN", label: "SCRIPT" },
        { entity: "sensor.signal", type: "vu_meter", min: 0, max: 100, segments: 12, show_scale: true, label: "SIGNAL" },
        { entity: "sensor.temperature_a", type: "seven_segment", num_digits: 4, leading_zeros: true, maximum_fraction_digits: 0, color: "amber", label: "TEMP" },
        { entity: "sensor.speed", type: "gauge", min: -10, max: 110, major_ticks: 5, unit: "°C", label: "SPEED" },
      ],
    },
    {
      entities: [
        { entity: "input_button.fire", type: "button", color: "amber", text: "RESET", label: "RESET" },
      ],
    },
  ],
};

test.describe("screenshots", () => {
  for (const theme of THEMES) {
    test(`theme ${theme}`, async ({ page }) => {
      await page.goto("/tests/ui/fixtures/index.html");
      await page.waitForFunction(() => !!(window as { __retro?: unknown }).__retro);
      await page.evaluate(
        ({ cfg, theme }) => {
          const w = window as any;
          // Light it up so the button glow + lever-up state read in the shot.
          w.__retro.states["input_boolean.toggle"].state = "on";
          w.__retro.setConfig({ ...cfg, theme });
          w.__retro.renderHass();
        },
        { cfg: CONFIG, theme },
      );
      // Let the needle/segment transitions settle.
      await page.waitForTimeout(500);
      const card = page.locator("retro-controlpanel-card");
      await card.screenshot({ path: `screenshots/${theme}.png` });
    });
  }
});
