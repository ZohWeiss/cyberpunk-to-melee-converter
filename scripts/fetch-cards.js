#!/usr/bin/env node
/**
 * Downloads the Cyberpunk TCG card list (the same public API cyberpunktcg.com/cards
 * uses) and writes a compact copy to test/fixtures/cards.json.
 *
 *   node scripts/fetch-cards.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const API = "https://api.netdeck.gg/api/cards/cyberpunk";
const PAGE = 100;
const OUT = path.join(__dirname, "..", "test", "fixtures", "cards.json");

async function getPage(offset) {
  const res = await fetch(`${API}?limit=${PAGE}&offset=${offset}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for offset ${offset}`);
  return res.json();
}

async function main() {
  const first = await getPage(0);
  const items = [...first.items];
  for (let offset = PAGE; offset < first.total; offset += PAGE) {
    items.push(...(await getPage(offset)).items);
  }

  const cards = items
    .map((c) => ({
      name: c.name,
      subname: c.subname || null,
      displayName: c.display_name,
      type: c.card_type,
      color: c.color,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(cards, null, 2) + "\n");
  console.log(`Wrote ${cards.length} of ${first.total} cards to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
