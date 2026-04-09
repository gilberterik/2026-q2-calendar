// generate-ics.js — Run with: node generate-ics.js
// Reads data.js and writes calendar.ics to the repo root.
// Uses only Node built-ins — no npm install needed.

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { createHash } from "crypto";

// Load data.js via dynamic import (it's an ES module)
const { PERIODS, OWNER_NAME, TEXAS_CITY, FLORIDA_CITY } = await import("./data.js");

const FLORIDA_DEFAULT = FLORIDA_CITY ?? "Florida";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toIcsDate(str) {
  // "YYYY-MM-DD" → "YYYYMMDD" (all-day date value)
  return str.replace(/-/g, "");
}

function toIcsDatetime(d = new Date()) {
  // UTC datetime stamp for DTSTAMP
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// End date for an all-day ICS event is exclusive, so add one day
function nextDay(str) {
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function uid(period) {
  const raw = `${period.start}-${period.end}-${period.status}`;
  return createHash("md5").update(raw).digest("hex") + "@q2-calendar";
}

function foldLine(line) {
  // ICS spec: lines > 75 octets must be folded with CRLF + space
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const limit = first ? 75 : 74; // first line has no leading space
    chunks.push(bytes.slice(offset, offset + limit).toString("utf8"));
    offset += limit;
    first = false;
  }
  return chunks.join("\r\n ");
}

// ─── Build ICS ───────────────────────────────────────────────────────────────

const now = toIcsDatetime();
const lines = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//q2-calendar//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  `X-WR-CALNAME:${OWNER_NAME}'s Schedule`,
  `X-WR-CALDESC:When ${OWNER_NAME} is in Texas vs Florida`,
  "X-WR-TIMEZONE:America/Chicago",
];

for (const p of PERIODS) {
  const location = p.location
    ?? (p.status === "texas" ? TEXAS_CITY : FLORIDA_DEFAULT);

  const summary = p.status === "texas"
    ? `Texas — ${TEXAS_CITY}`
    : (p.label ? `Florida — ${p.label}` : `Florida`);

  lines.push(
    "BEGIN:VEVENT",
    `UID:${uid(p)}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${toIcsDate(p.start)}`,
    `DTEND;VALUE=DATE:${nextDay(p.end)}`,
    foldLine(`SUMMARY:${summary}`),
    foldLine(`LOCATION:${location}`),
    p.label ? foldLine(`DESCRIPTION:${p.label}`) : "DESCRIPTION:",
    `STATUS:CONFIRMED`,
    `TRANSP:TRANSPARENT`,
    "END:VEVENT",
  );
}

lines.push("END:VCALENDAR");

const ics = lines.join("\r\n") + "\r\n";
writeFileSync("calendar.ics", ics, "utf8");
console.log(`✓ calendar.ics written (${PERIODS.length} events)`);
