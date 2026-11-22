/**
 * Converts an official Cyberpunk TCG decklist into a Melee.gg-compatible one.
 *
 * Works in the browser (exposes window.convertDecklist) and in Node:
 *   node convert.js deck.txt
 *   cat deck.txt | node convert.js
 */
(function (root) {
  "use strict";

  // Melee.gg sections, named and ordered exactly as Melee.gg's own .txt export.
  var SECTIONS = ["MainDeck", "Legends", "Sideboard"];

  // Lines starting with a count, e.g. "3 Pyramid Song" or "3x Pyramid Song".
  var CARD_LINE = /^(\d+)\s*x?\s+(.+)$/i;

  // "// Units (17)" style comment headers. Anything after // is a header.
  var COMMENT_HEADER = /^\/\/\s*(.*?)\s*(?:\(\d+\))?\s*:?$/;

  // Bare headers ("Legends", "MainDeck", "Sideboard (7)") are only recognised
  // when they are a known section name, so a card line missing its count is
  // reported instead of being silently treated as a header.
  var BARE_HEADER = /^(.*?)\s*(?:\(\d+\))?\s*:?$/;
  var KNOWN_SECTIONS = {
    legend: "Legends",
    legends: "Legends",
    unit: "MainDeck",
    units: "MainDeck",
    program: "MainDeck",
    programs: "MainDeck",
    gear: "MainDeck",
    gears: "MainDeck",
    main: "MainDeck",
    "main deck": "MainDeck",
    maindeck: "MainDeck",
    deck: "MainDeck",
    sideboard: "Sideboard",
    side: "Sideboard",
    "side deck": "Sideboard"
  };

  function knownSection(headerName) {
    var key = headerName.trim().toLowerCase().replace(/\s+/g, " ");
    return Object.prototype.hasOwnProperty.call(KNOWN_SECTIONS, key) ? KNOWN_SECTIONS[key] : null;
  }

  // "Lizzy Wizzy: Delicate Weapon" -> "Lizzy Wizzy | Delicate Weapon".
  // Also accepts the card site's "V — Streetkid", a spaced slash, or an
  // existing pipe as the subtitle separator.
  function formatCardName(name) {
    return name
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\s*[:|]\s*|\s+[\/–—]\s+/, " | ");
  }

  function convertDecklist(text) {
    var cards = {}; // section -> { order: [names], counts: {name: n} }
    SECTIONS.forEach(function (s) {
      cards[s] = { order: [], counts: {} };
    });

    var warnings = [];
    var current = "MainDeck";

    String(text || "")
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .forEach(function (raw, i) {
        var line = raw.trim();
        if (!line) return;
        if (line.charAt(0) === "#") return; // title / metadata comments

        var card = line.match(CARD_LINE);
        if (card) {
          var count = parseInt(card[1], 10);
          var name = formatCardName(card[2]);
          var bucket = cards[current];
          if (!(name in bucket.counts)) {
            bucket.order.push(name);
            bucket.counts[name] = 0;
          }
          bucket.counts[name] += count;
          return;
        }

        var comment = line.match(COMMENT_HEADER);
        if (comment) {
          // Unknown "// Whatever" headers (Units, Programs, ...) go in the main deck.
          current = knownSection(comment[1]) || "MainDeck";
          return;
        }

        var bare = knownSection(line.match(BARE_HEADER)[1]);
        if (bare) {
          current = bare;
          return;
        }

        warnings.push("Line " + (i + 1) + " skipped: " + line);
      });

    var totals = {};
    var blocks = [];
    SECTIONS.forEach(function (section) {
      var bucket = cards[section];
      totals[section] = 0;
      if (!bucket.order.length) return;
      var lines = bucket.order.map(function (name) {
        totals[section] += bucket.counts[name];
        return bucket.counts[name] + " " + name;
      });
      blocks.push(section + "\n" + lines.join("\n"));
    });

    return { output: blocks.join("\n\n"), totals: totals, warnings: warnings };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { convertDecklist: convertDecklist, formatCardName: formatCardName };

    if (typeof require !== "undefined" && require.main === module) {
      var fs = require("fs");
      var file = process.argv[2];
      var input = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
      var result = convertDecklist(input);
      result.warnings.forEach(function (w) {
        process.stderr.write("warning: " + w + "\n");
      });
      process.stdout.write(result.output + "\n");
    }
  } else {
    root.convertDecklist = convertDecklist;
  }
})(this);
