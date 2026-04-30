#!/usr/bin/env node

const URL = "https://dolarhoy.com/";
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function parseMoneyAr(s) {
  if (typeof s !== "string") return NaN;
  const cleaned = s.replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? NaN : n;
}

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

function extractVentas(html) {
  const re =
    /<div class="label">Venta<\/div><div class="val">\s*\$([\d.,]+)\s*<\/div><\/div>/g;

  return [...html.matchAll(re)].map((m) => m[1]);
}

async function fetchDolarVentas() {
  const html = await fetchTextWithTimeout(URL, REQUEST_TIMEOUT_MS);
  const ventas = extractVentas(html);
  const ventaBlue = ventas[0] ?? null;
  const ventaOficial = ventas[1] ?? null;

  if (!ventaBlue || !ventaOficial) {
    throw new Error(
      `No pude extraer ventas suficientes. Encontré ${ventas.length} apariciones.`
    );
  }

  return {
    ventaBlueText: ventaBlue.replace(/\s+/g, ""),
    ventaOficialText: ventaOficial.replace(/\s+/g, ""),
    ventaBlue: parseMoneyAr(ventaBlue),
    ventaOficial: parseMoneyAr(ventaOficial),
  };
}

module.exports = {
  fetchDolarVentas,
};

if (require.main === module) {
  (async () => {
    const { ventaBlueText, ventaOficialText } = await fetchDolarVentas();
    console.log(`Venta dolar blue: $${ventaBlueText}`);
    console.log(`Venta dolar oficial: $${ventaOficialText}`);
  })().catch((err) => {
    console.error(err?.message || String(err));
    process.exitCode = 1;
  });
}

