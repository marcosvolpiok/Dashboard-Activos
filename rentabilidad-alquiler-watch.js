#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs/promises");

const { fetchDolarVentas } = require("./dolarhoy-venta");

const PORTFOLIO_PATH =
  process.argv[2] || path.join(__dirname, "cartera-deptos.json");

const POLL_MS = 60 * 60 * 1000 * 5;

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
};

function formatMoney(n, decimals = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(decimals);
}

function formatPercent(n, decimals = 3) {
  if (typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return `${n.toFixed(decimals)}%`;
}

function padRight(s, w) {
  const str = String(s);
  return str.length >= w ? str : str + " ".repeat(w - str.length);
}

function padLeft(s, w) {
  const str = String(s);
  return str.length >= w ? str : " ".repeat(w - str.length) + str;
}

function safeNumber(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : NaN;
}

function normalizeDepartamento(raw, idx) {
  const id = typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `dpto_${idx + 1}`;

  const alquilerArsMensual = safeNumber(raw?.alquiler_ars_mensual);
  const compraUsd = safeNumber(raw?.compra_usd);

  const extras = Array.isArray(raw?.extras_usd) ? raw.extras_usd : [];
  const extrasUsd = extras.map(safeNumber).filter((n) => Number.isFinite(n));

  const totalUsd = compraUsd + extrasUsd.reduce((a, b) => a + b, 0);

  return {
    id,
    alquiler_ars_mensual: alquilerArsMensual,
    compra_usd: compraUsd,
    extras_usd: extrasUsd,
    total_usd: totalUsd,
  };
}

async function readPortfolio(filePath) {
  const txt = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(txt);
  const arr = Array.isArray(json?.departamentos) ? json.departamentos : [];
  return arr.map(normalizeDepartamento);
}

function computeYield(dpto, ventaOficial) {
  const usd = safeNumber(ventaOficial);
  const alquilerMensual = safeNumber(dpto?.alquiler_ars_mensual);
  const totalUsd = safeNumber(dpto?.total_usd);

  const ingresoMensualUsd = alquilerMensual / usd;
  const ingreso10yUsd = ingresoMensualUsd * 12 * 10;
  const alquilerAnualUsd = (alquilerMensual * 12) / usd;
  const rentabilidad = alquilerAnualUsd / totalUsd; // ratio, ej 0.10 => 10%
  const rentabilidad10y = (alquilerAnualUsd * 10) / totalUsd; // ratio a 10 años

  return {
    ingresoMensualUsd,
    ingreso10yUsd,
    alquilerAnualUsd,
    rentabilidad,
    rentabilidad10y,
  };
}

function renderScreen({ ventaOficial, portfolioPath, departamentos }) {
  console.clear();
  const nowLocal = new Date().toLocaleString();

  console.log(`${ANSI.bold}Rentabilidad alquiler - cartera de departamentos${ANSI.reset}`);
  console.log(`${ANSI.dim}Local:${ANSI.reset} ${nowLocal}`);
  console.log(`${ANSI.dim}Dólar oficial (venta):${ANSI.reset} $${formatMoney(ventaOficial, 2)}`);
  console.log(`${ANSI.dim}Cartera:${ANSI.reset} ${portfolioPath}`);
  console.log("");

  if (!departamentos.length) {
    console.log(`${ANSI.red}No hay departamentos en el JSON.${ANSI.reset}`);
    return;
  }

  const rows = departamentos.map((d) => {
    const {
      ingresoMensualUsd,
      ingreso10yUsd,
      alquilerAnualUsd,
      rentabilidad,
      rentabilidad10y,
    } = computeYield(d, ventaOficial);
    return {
      id: d.id,
      alquiler_ars_mensual: d.alquiler_ars_mensual,
      total_usd: d.total_usd,
      ingreso_mensual_usd: ingresoMensualUsd,
      ingreso_10a_usd: ingreso10yUsd,
      alquiler_anual_usd: alquilerAnualUsd,
      rentabilidad_pct: rentabilidad * 100,
      rentabilidad_10a_pct: rentabilidad10y * 100,
    };
  });

  const headers = [
    ["ID", 18],
    ["Alquiler ARS/mes", 18],
    ["Ingreso USD/mes", 16],
    ["Ingreso USD/10a", 16],
    ["Costo total USD", 16],
    ["Alquiler anual USD", 18],
    ["Rentab. anual", 14],
    ["Rentab. 10a", 12],
  ];

  console.log(
    headers.map(([h, w]) => padRight(h, w)).join("  ")
  );
  console.log(
    headers.map(([, w]) => "-".repeat(w)).join("  ")
  );

  for (const r of rows) {
    console.log(
      [
        padRight(r.id, 18),
        padLeft(formatMoney(r.alquiler_ars_mensual, 0), 18),
        padLeft(formatMoney(r.ingreso_mensual_usd, 2), 16),
        padLeft(formatMoney(r.ingreso_10a_usd, 2), 16),
        padLeft(formatMoney(r.total_usd, 0), 16),
        padLeft(formatMoney(r.alquiler_anual_usd, 2), 18),
        padLeft(formatPercent(r.rentabilidad_pct, 3), 14),
        padLeft(formatPercent(r.rentabilidad_10a_pct, 3), 12),
      ].join("  ")
    );
  }

  const totalMonthlyRentUsd = rows
    .map((r) => r.ingreso_mensual_usd)
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
  const totalIncome10yUsd = totalMonthlyRentUsd * 12 * 10;
  const totalInvested = rows
    .map((r) => r.total_usd)
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
  const totalAnnualRentUsd = rows
    .map((r) => r.alquiler_anual_usd)
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
  const portfolioYield = totalAnnualRentUsd / totalInvested;
  const portfolioYield10y = (totalAnnualRentUsd * 10) / totalInvested;

  console.log("");
  console.log(
    `${ANSI.bold}Cartera total${ANSI.reset}  ` +
      `invertido USD ${formatMoney(totalInvested, 0)}  ` +
      `ingreso mensual USD ${formatMoney(totalMonthlyRentUsd, 2)}  ` +
      `ingreso 10a USD ${formatMoney(totalIncome10yUsd, 2)}  ` +
      `alquiler anual USD ${formatMoney(totalAnnualRentUsd, 2)}  ` +
      `rentab. ${formatPercent(portfolioYield * 100, 3)}  ` +
      `rentab. 10a ${formatPercent(portfolioYield10y * 100, 3)}`
  );
  console.log("");
  console.log(
    `${ANSI.dim}Refresco:${ANSI.reset} cada ${Math.round(POLL_MS / 60_000)} minutos (se actualiza con el valor del dólar).`
  );
}

function renderErrorScreen(err, portfolioPath) {
  console.clear();
  const nowLocal = new Date().toLocaleString();
  console.log(`${ANSI.bold}Rentabilidad alquiler - cartera de departamentos${ANSI.reset}`);
  console.log(`${ANSI.dim}Local:${ANSI.reset} ${nowLocal}`);
  console.log(`${ANSI.dim}Cartera:${ANSI.reset} ${portfolioPath}`);
  console.log("");
  console.log(`${ANSI.red}Error:${ANSI.reset} ${err?.message || String(err)}`);
  console.log(`${ANSI.dim}Reintentando en ${Math.round(POLL_MS / 60_000)} minutos...${ANSI.reset}`);
}

async function tick() {
  try {
    const departamentos = await readPortfolio(PORTFOLIO_PATH);
    const { ventaOficial } = await fetchDolarVentas();
    if (!Number.isFinite(ventaOficial)) {
      throw new Error("No pude parsear el valor de venta del dólar oficial.");
    }
    renderScreen({
      ventaOficial,
      portfolioPath: PORTFOLIO_PATH,
      departamentos,
    });
  } catch (err) {
    renderErrorScreen(err, PORTFOLIO_PATH);
  }
}

(async () => {
  await tick();
  setInterval(tick, POLL_MS);
})().catch((err) => renderErrorScreen(err, PORTFOLIO_PATH));

