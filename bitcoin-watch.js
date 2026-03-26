#!/usr/bin/env node

const ENDPOINT = "https://api.api-ninjas.com/v1/bitcoin";
const POLL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

// Recomendado: export API_NINJAS_KEY="..."
const API_KEY =
  process.env.API_NINJAS_KEY ||
  "dl1tXJ1CrqumiJQWoB5RgSDtASiQKRq47WoLRkjX";

const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function colorizeSigned(n, text) {
  if (typeof n !== "number" || Number.isNaN(n)) return text;
  if (n > 0) return `${ANSI.green}${text}${ANSI.reset}`;
  if (n < 0) return `${ANSI.red}${text}${ANSI.reset}`;
  return `${ANSI.yellow}${text}${ANSI.reset}`;
}

function arrowFor(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  if (n > 0) return "^";
  if (n < 0) return "v";
  return "-";
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? NaN : n;
  }
  return NaN;
}

function formatMoney(n, decimals = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(decimals);
}

function formatPercent(n, decimals = 3) {
  if (typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return `${n.toFixed(decimals)}%`;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": API_KEY,
        "accept": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function renderScreen(payload) {
  console.clear();
  const nowLocal = new Date().toLocaleString();

  const price = toNumber(payload?.price);
  const chg = toNumber(payload?.["24h_price_change"]);
  const pc = toNumber(payload?.["24h_price_change_percent"]);
  const high = toNumber(payload?.["24h_high"]);

  console.log(`${ANSI.bold}Bitcoin (BTC)${ANSI.reset}`);
  console.log(`${ANSI.dim}Local:${ANSI.reset} ${nowLocal}`);
  console.log("");

  console.log(`Price: ${ANSI.bold}${formatMoney(price, 2)}${ANSI.reset}`);

  const chgText = `${arrowFor(chg)} ${formatMoney(chg, 2)}`;
  console.log(`24h_price_change: ${colorizeSigned(chg, chgText)}`);

  const pcText = `${arrowFor(pc)} ${formatPercent(pc, 3)}`;
  console.log(`24h_price_change_percent: ${colorizeSigned(pc, pcText)}`);

  console.log(`24h_high: ${ANSI.bold}${formatMoney(high, 2)}${ANSI.reset}`);

  console.log("");
  console.log(`${ANSI.dim}Endpoint:${ANSI.reset} ${ENDPOINT}`);
  console.log(`${ANSI.dim}Refresco:${ANSI.reset} cada ${Math.round(POLL_MS / 60_000)} minutos`);
}

function renderErrorScreen(err) {
  console.clear();
  const nowLocal = new Date().toLocaleString();
  console.log(`${ANSI.bold}Bitcoin (BTC)${ANSI.reset}`);
  console.log(`${ANSI.dim}Local:${ANSI.reset} ${nowLocal}`);
  console.log("");
  console.log(`${ANSI.red}Error:${ANSI.reset} ${err?.message || String(err)}`);
  console.log(`${ANSI.dim}Reintentando en ${Math.round(POLL_MS / 60_000)} minutos...${ANSI.reset}`);
  console.log("");
  console.log(`${ANSI.dim}Endpoint:${ANSI.reset} ${ENDPOINT}`);
}

async function tick() {
  try {
    if (!API_KEY) throw new Error("Falta API key (setear API_NINJAS_KEY).");
    const payload = await fetchJsonWithTimeout(ENDPOINT, REQUEST_TIMEOUT_MS);
    renderScreen(payload);
  } catch (err) {
    renderErrorScreen(err);
  }
}

(async () => {
  await tick();
  setInterval(tick, POLL_MS);
})().catch(renderErrorScreen);

