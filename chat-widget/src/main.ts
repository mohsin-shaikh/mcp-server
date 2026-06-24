import { mountWidget, type WidgetConfig } from "./widget.js";

function readConfig(): WidgetConfig {
  const script = document.currentScript;
  const apiUrl =
    script instanceof HTMLScriptElement && script.dataset["apiUrl"]
      ? script.dataset["apiUrl"]
      : "http://127.0.0.1:3200";

  const themeRaw = script instanceof HTMLScriptElement ? script.dataset["theme"] : undefined;
  const theme = themeRaw === "dark" ? "dark" : "light";

  return { apiUrl, theme };
}

function init(): void {
  mountWidget(readConfig());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
