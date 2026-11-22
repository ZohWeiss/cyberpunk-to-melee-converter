# Cyberpunk TCG → Melee.gg decklist converter

Paste an official Cyberpunk TCG decklist and get a Melee.gg-compatible one back, copied to your clipboard.

## What it does

- Drops `#` comment lines (title, source, id, and so on).
- Puts `// Legends` cards under **Legends** and `// Sideboard` cards under **Sideboard**. Every other section (Units, Gear, Programs, …) goes under **MainDeck**. Section names and order (MainDeck, Legends, Sideboard) match Melee.gg's own `.txt` export, so pasting a Melee export back in returns it unchanged.
- Rewrites subtitles: `Lizzy Wizzy: Delicate Weapon` → `Lizzy Wizzy | Delicate Weapon`. Melee.gg rejects `/`.
- Combines duplicate cards within a section and skips empty sections.
- Lists any lines it couldn't read, so nothing disappears without notice.

## Use it

- **Web:** open `index.html`, or the GitHub Pages URL.
- **CLI (Node):** `node convert.js examples/alt-control-bbv.txt`, or pipe the decklist in through stdin.
