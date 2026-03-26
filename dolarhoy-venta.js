#!/usr/bin/env node

const URL = "https://dolarhoy.com/";
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "pragma": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function extractVenta(html) {
  const re =
    /<div class="label">Venta<\/div><div class="val">\s*\$([\d.,]+)\s*<\/div><\/div>/;

  const m = html.match(re);
  return m ? m[1] : null;
}

(async () => {
  const html = await fetchTextWithTimeout(URL, REQUEST_TIMEOUT_MS);
  const venta = extractVenta(html);
  if (!venta) {
    throw new Error("No pude extraer el precio de Venta.");
  }

  console.log(`Venta: $${venta.replace(/\s+/g, "")}`);
})().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});

