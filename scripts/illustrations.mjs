#!/usr/bin/env node
// Draws the docs' illustrations (docs/illustrations/*.svg) from the spec's values.
// They are drawings, not Compose renders: each one says so in its header band.
// Colours are Material 3's baseline roles (Material3 1.3), since every app keeps
// its own values and only the roles' meanings are Gamme's. No dependencies:
//   node scripts/illustrations.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { glyphs } from "./glyphs.mjs"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "illustrations")

// --- Material 3 baseline roles ----------------------------------------------

const light = {
  name: "Light",
  primary: "#6750A4", onPrimary: "#FFFFFF",
  primaryContainer: "#EADDFF", onPrimaryContainer: "#21005D",
  secondaryContainer: "#E8DEF8", onSecondaryContainer: "#1D192B",
  surface: "#FEF7FF", onSurface: "#1D1B20", onSurfaceVariant: "#49454F",
  surfaceContainer: "#F3EDF7", surfaceContainerHigh: "#ECE6F0", surfaceContainerHighest: "#E6E0E9",
  outline: "#79747E", outlineVariant: "#CAC4D0", error: "#B3261E",
  inverseSurface: "#322F35", inverseOnSurface: "#F5EFF7",
}
const dark = {
  name: "Dark",
  primary: "#D0BCFF", onPrimary: "#381E72",
  primaryContainer: "#4F378B", onPrimaryContainer: "#EADDFF",
  secondaryContainer: "#4A4458", onSecondaryContainer: "#E8DEF8",
  surface: "#141218", onSurface: "#E6E0E9", onSurfaceVariant: "#CAC4D0",
  surfaceContainer: "#211F26", surfaceContainerHigh: "#2B2930", surfaceContainerHighest: "#36343B",
  outline: "#938F99", outlineVariant: "#49454F", error: "#F2B8B5",
  inverseSurface: "#E6E0E9", inverseOnSurface: "#322F35",
}
const black = { ...dark, name: "Dark, true black", surface: "#000000" }

// --- contrast ----------------------------------------------------------------

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// --- drawing helpers ---------------------------------------------------------

const FONT = "Roboto, 'Google Sans Text', system-ui, -apple-system, 'Segoe UI', sans-serif"
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
let uid = 0
const id = (p) => `${p}${++uid}`

const text = (x, y, s, { size = 14, weight = 400, fill, anchor = "start", opacity, spacing } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"${
    anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${opacity != null ? ` opacity="${opacity}"` : ""}${
    spacing != null ? ` letter-spacing="${spacing}"` : ""}>${esc(s)}</text>`

const glyph = (name, x, y, size, fill, opacity) => {
  if (name === "ring_dashed") {
    const s = size / 24
    return `<circle cx="${x + 12 * s}" cy="${y + 12 * s}" r="${9 * s}" fill="none" stroke="${fill}" stroke-width="${2 * s}" stroke-dasharray="${3.4 * s} ${2.25 * s}"${opacity != null ? ` opacity="${opacity}"` : ""}/>`
  }
  const d = glyphs[name]
  if (!d) throw new Error(`no glyph ${name}`)
  return `<g transform="translate(${x} ${y}) scale(${size / 960}) translate(0 960)"${opacity != null ? ` opacity="${opacity}"` : ""}><path d="${d}" fill="${fill}"/></g>`
}

// Rough advance widths for the system face, to size chips and centre things.
const width = (s, size, weight = 400) => s.length * size * (weight >= 600 ? 0.58 : 0.54)

const W = 412 // a phone screen, in dp

/**
 * Stacks one panel per scheme under a header band that says what this is.
 * draw(scheme, y) returns { svg, h } for the panel's content.
 */
const panels = (title, list, draw) => {
  const band = 56
  let y = band
  const parts = []
  for (const p of list) {
    const s = p.scheme
    const label = p.label ?? s.name
    const body = draw(s, y + 32, p)
    const h = 32 + body.h + 16
    parts.push(`<rect x="0" y="${y}" width="${W}" height="${h}" fill="${s.surface}"/>`)
    const lx = 16
    let labelSvg = ""
    if (p.glyph) {
      labelSvg += glyph(p.glyph, lx, y + 8, 18, s.onSurface)
      labelSvg += text(lx + 24, y + 22, label, { size: 13, weight: 600, fill: s.onSurface, spacing: 0.1 })
    } else {
      labelSvg += text(lx, y + 22, label, { size: 12, weight: 500, fill: s.onSurfaceVariant, spacing: 0.5 })
    }
    parts.push(labelSvg, body.svg)
    if (p.dashed) parts.push(`<rect x="1.5" y="${y + 1.5}" width="${W - 3}" height="${h - 3}" fill="none" stroke="${s.outline}" stroke-width="3" stroke-dasharray="8 6"/>`)
    y += h
  }
  const header =
    `<rect x="0" y="0" width="${W}" height="${band}" fill="#1D1B20"/>` +
    text(16, 23, title, { size: 14, weight: 500, fill: "#E6E0E9", spacing: 0.1 }) +
    text(16, 42, "Illustration, not a render", { size: 12, fill: "#CAC4D0", spacing: 0.4 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" font-family="${FONT}" role="img" aria-label="${esc(title)}: illustration, not a render">
<title>${esc(title)} (illustration, not a render)</title>
${header}${parts.join("\n")}
</svg>
`
}

// --- components, drawn from the spec's numbers ------------------------------

const heading = (s, y, title) => ({ svg: text(32, y + 24 + 14, title, { size: 14, weight: 500, fill: s.onSurface, spacing: 0.1 }), h: 24 + 20 + 8 })

const switchGlyph = (s, x, y, checked, disabled) => {
  const o = disabled ? 0.38 : null
  const op = o != null ? ` opacity="${o}"` : ""
  if (checked) {
    return `<g${op}><rect x="${x}" y="${y}" width="52" height="32" rx="16" fill="${disabled ? s.onSurface : s.primary}"/>` +
      `<circle cx="${x + 36}" cy="${y + 16}" r="12" fill="${disabled ? s.surface : s.onPrimary}"/></g>` +
      glyph("check", x + 28, y + 8, 16, disabled ? s.onSurface : s.onPrimaryContainer, o)
  }
  return `<g${op}><rect x="${x + 1}" y="${y + 1}" width="50" height="30" rx="15" fill="${s.surfaceContainerHighest}" stroke="${disabled ? s.onSurface : s.outline}" stroke-width="2"/>` +
    `<circle cx="${x + 16}" cy="${y + 16}" r="8" fill="${disabled ? s.onSurface : s.outline}"/></g>`
}

const radio = (s, x, y, selected) =>
  `<circle cx="${x + 12}" cy="${y + 12}" r="9" fill="none" stroke="${selected ? s.primary : s.onSurfaceVariant}" stroke-width="2"/>` +
  (selected ? `<circle cx="${x + 12}" cy="${y + 12}" r="5" fill="${s.primary}"/>` : "")

/** One SettingsRow / SwitchRow, 16 dp padding, 24 dp slot, 56 dp minimum. */
const row = (s, x, y, w, r) => {
  const lines = r.unavailable || r.notice || r.detail ? 2 : 1
  const h = lines === 2 ? 68 : 56
  const fade = r.unavailable ? 0.6 : null
  const titleFill = r.destructive ? s.error : s.onSurface
  const glyphFill = r.destructive ? s.error : s.onSurfaceVariant
  let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${r.tile ? s.surfaceContainer : s.surfaceContainer}"/>`
  let tx = x + 16
  if (r.radio != null) {
    svg += radio(s, x + 16, y + (h - 24) / 2, r.radio)
    tx = x + 56
  } else if (r.tile && r.glyph) {
    svg += `<circle cx="${x + 36}" cy="${y + h / 2}" r="20" fill="${s.secondaryContainer}"/>` + glyph(r.glyph, x + 26, y + h / 2 - 10, 20, s.onSecondaryContainer)
    tx = x + 72
  } else if (r.glyph) {
    svg += glyph(r.glyph, x + 16, y + (h - 24) / 2, 24, glyphFill, fade)
    tx = x + 56
  } else if (r.slot) {
    tx = x + 56
  }
  const top = lines === 2 ? y + 12 : y + 16
  svg += text(tx, top + 17, r.title, { size: 16, fill: titleFill, opacity: r.faded ?? fade, spacing: 0.5 })
  const second = r.unavailable ?? r.notice
  if (second) {
    if (r.noReason) {
      svg += text(tx, top + 24 + 15, second, { size: 14, fill: s.onSurfaceVariant, opacity: r.faded, spacing: 0.25 })
    } else {
      svg += glyph("warning", tx, top + 24 + 2, 16, s.onSurfaceVariant) + text(tx + 22, top + 24 + 15, second, { size: 14, fill: s.onSurfaceVariant, spacing: 0.25 })
    }
  } else if (r.detail) {
    let dx = tx
    if (r.state) {
      const g = { Done: "check_circle", NotYet: "ring", OnItsWay: "sync", Resting: "moon", NeedsALook: "warning", NotKnown: "ring_dashed" }[r.state]
      const f = r.state === "Done" ? s.onSurface : r.state === "NotKnown" ? s.outline : s.onSurfaceVariant
      svg += glyph(g, tx, top + 24 + 2, 16, f)
      dx += 22
    }
    svg += text(dx, top + 24 + 15, r.detail, { size: 14, fill: s.onSurfaceVariant, opacity: r.faded, spacing: 0.25 })
  }
  if (r.opens) svg += glyph("chevron_end", x + w - 40, y + (h - 24) / 2, 24, s.onSurfaceVariant)
  if (r.switch != null) svg += switchGlyph(s, x + w - 68, y + (h - 32) / 2, r.switch, !!r.unavailable)
  return { svg, h }
}

/** A SettingsGroup: heading 32 dp from the edge, card inset 16 dp, rows 2 dp apart, clipped to 20 dp. */
const group = (s, y, title, rows, { footnote, headingAt = 32 } = {}) => {
  let svg = ""
  let h = 0
  if (title) {
    svg += text(headingAt, y + 24 + 14, title, { size: 14, weight: 500, fill: s.onSurface, spacing: 0.1 })
    h += 24 + 20 + 8
  }
  const cid = id("clip")
  let ry = y + h
  let inner = ""
  for (const r of rows) {
    const out = row(s, 16, ry, W - 32, r)
    inner += out.svg
    ry += out.h + 2
  }
  const cardH = ry - 2 - (y + h)
  svg += `<clipPath id="${cid}"><rect x="16" y="${y + h}" width="${W - 32}" height="${cardH}" rx="20"/></clipPath><g clip-path="url(#${cid})">${inner}</g>`
  h += cardH
  if (footnote) {
    svg += text(32, y + h + 8 + 13, footnote, { size: 12, fill: s.onSurfaceVariant, spacing: 0.4 })
    h += 8 + 16
  }
  return { svg, h }
}

const files = {}
const both = [{ scheme: light }, { scheme: dark }]

// SettingsGroup
files["settings-group.svg"] = panels("SettingsGroup", both, (s, y) =>
  group(s, y - 24, "Keyboard", [
    { glyph: "keyboard", title: "Layout", detail: "QWERTY", opens: true },
    { glyph: "clipboard", title: "Clipboard history", switch: true },
    { slot: true, title: "Key height", detail: "Medium" },
  ], { footnote: "Footnote at the heading's inset, 8 dp under the card." }))

// SettingsRow, one per variant
files["settings-row.svg"] = panels("SettingsRow: its variants", both, (s, y) => {
  const a = group(s, y - 24, "Rows", [
    { glyph: "wifi", title: "Read-only, with a state", detail: "Connected", state: "Done" },
    { glyph: "settings", title: "Opens a screen", opens: true },
    { glyph: "notifications", title: "Unavailable", unavailable: "Turn on notifications first" },
    { glyph: "schedule", title: "With a notice", notice: "Battery saver is on", switch: true },
    { glyph: "delete", title: "Empty bin", destructive: true },
  ])
  const b = group(s, y - 24 + a.h, "Radio rows (selected)", [
    { radio: true, title: "Follow the system" },
    { radio: false, title: "Always light" },
  ])
  return { svg: a.svg + b.svg, h: a.h + b.h - 24 }
})

// SwitchRow
files["switch-row.svg"] = panels("SwitchRow", both, (s, y) =>
  group(s, y - 24, "Sync", [
    { glyph: "wifi", title: "Only on Wi-Fi", switch: true },
    { glyph: "moon", title: "Pause at night", detail: "From 23:00 to 07:00", switch: false },
    { glyph: "notifications", title: "Notify when done", unavailable: "Notifications are off for this app", switch: false },
  ]))

// StateMark
files["state-mark.svg"] = panels("StateMark: the six states", both, (s, y) =>
  group(s, y, null, [
    { title: "Done", detail: "Words carry the state", state: "Done" },
    { title: "NotYet", detail: "Words carry the state", state: "NotYet" },
    { title: "OnItsWay", detail: "Words carry the state", state: "OnItsWay" },
    { title: "Resting", detail: "Words carry the state", state: "Resting" },
    { title: "NeedsALook", detail: "Words carry the state", state: "NeedsALook" },
    { title: "NotKnown", detail: "Words carry the state", state: "NotKnown" },
  ]))

// EmptyState
files["empty-state.svg"] = panels("EmptyState", both, (s, y) => {
  const cx = W / 2
  let svg = `<circle cx="${cx}" cy="${y + 40 - 24 + 28}" r="28" fill="${s.surfaceContainerHigh}"/>` + glyph("inventory", cx - 14, y + 40 - 24 + 14, 28, s.onSurfaceVariant)
  let yy = y + 40 - 24 + 56 + 16
  svg += text(cx, yy + 18, "Nothing saved yet", { size: 16, weight: 500, fill: s.onSurface, anchor: "middle", spacing: 0.15 })
  yy += 24 + 4
  svg += text(cx, yy + 15, "The detail line, in onSurfaceVariant.", { size: 14, fill: s.onSurfaceVariant, anchor: "middle", spacing: 0.25 })
  yy += 20 + 20
  const label = "One action"
  const bw = width(label, 14, 500) + 48
  svg += `<rect x="${cx - bw / 2}" y="${yy}" width="${bw}" height="40" rx="20" fill="${s.secondaryContainer}"/>` +
    text(cx, yy + 25, label, { size: 14, weight: 500, fill: s.onSecondaryContainer, anchor: "middle", spacing: 0.1 })
  yy += 40 + 40
  return { svg, h: yy - y }
})

// SelectChip
const chip = (s, x, y, label, selected, w, icon) => {
  let svg = `<rect x="${x}" y="${y}" width="${w}" height="36" rx="18" fill="${selected ? s.secondaryContainer : s.surfaceContainerHigh}"/>`
  const fg = selected ? s.onSecondaryContainer : s.onSurfaceVariant
  if (selected || icon) {
    const lw = width(label, 14, selected ? 600 : 500)
    const fx = x + (w - (18 + 8 + lw)) / 2
    svg += glyph(selected ? (icon ?? "check") : icon, fx, y + 9, 18, fg)
    svg += text(fx + 26, y + 23, label, { size: 14, weight: selected ? 600 : 500, fill: fg, spacing: 0.1 })
  } else {
    svg += text(x + w / 2, y + 23, label, { size: 14, weight: 500, fill: fg, anchor: "middle", spacing: 0.1 })
  }
  return svg
}
const chipWidth = (label) => 14 + 18 + 8 + width(label, 14, 600) + 14

files["select-chip.svg"] = panels("SelectChip", both, (s, y) => {
  const labels = ["All", "Work", "Recipes"]
  let x = 16
  let svg = ""
  const yy = y + 6
  labels.forEach((l, i) => {
    const w = chipWidth(l)
    svg += chip(s, x, yy, l, i === 1, w)
    if (i === 1) {
      svg += `<rect x="${x - 2}" y="${yy - 6}" width="${w + 4}" height="48" rx="6" fill="none" stroke="${s.outline}" stroke-width="1" stroke-dasharray="4 3"/>`
      svg += text(x + w / 2, yy + 58, "48 dp target", { size: 11, fill: s.onSurfaceVariant, anchor: "middle", spacing: 0.4 })
    }
    x += w + 8
  })
  // The no-reflow rule: the same chip, both faces, same width.
  const w = chipWidth("Recipes")
  const y2 = yy + 84
  svg += text(16, y2 - 10, "Width never changes: both faces share the widest size", { size: 12, fill: s.onSurfaceVariant, spacing: 0.4 })
  svg += chip(s, 16, y2, "Recipes", false, w) + chip(s, 16 + w + 24, y2, "Recipes", true, w)
  const my = y2 + 48
  for (const cx of [16, 16 + w + 24]) {
    svg += `<path d="M${cx} ${my - 4}v8M${cx + w} ${my - 4}v8M${cx} ${my}h${w}" stroke="${s.onSurfaceVariant}" stroke-width="1" fill="none"/>`
    svg += text(cx + w / 2, my + 16, `${Math.round(w)} dp`, { size: 11, fill: s.onSurfaceVariant, anchor: "middle" })
  }
  return { svg, h: my + 24 - y }
})

// GammeTheme: light, dark, true black
files["theme.svg"] = panels("GammeTheme: light, dark and true black", [{ scheme: light }, { scheme: dark }, { scheme: black }], (s, y) =>
  group(s, y - 24, "Display", [
    { glyph: "palette", title: "Dynamic colour", detail: "Android 12 and later", switch: s.name !== "Light" },
    { glyph: "moon", title: "True black", switch: s.name === "Dark, true black" },
  ]))

// Shape
files["shape.svg"] = panels("Shape: GammeShapes against Material's defaults", both, (s, y) => {
  const sh = [["extraSmall", 8, 4], ["small", 12, 8], ["medium", 16, 12], ["large", 20, 16], ["extraLarge", 28, 28]]
  let svg = ""
  sh.forEach(([n, r, m], i) => {
    const col = i % 3, line = Math.floor(i / 3)
    const x = 16 + col * 132, yy = y + line * 150
    svg += `<rect x="${x}" y="${yy}" width="116" height="84" rx="${r}" fill="${s.primaryContainer}"/>`
    svg += `<rect x="${x + 0.5}" y="${yy + 0.5}" width="115" height="83" rx="${m}" fill="none" stroke="${s.outline}" stroke-dasharray="3 3"/>`
    svg += text(x, yy + 104, n, { size: 14, weight: 500, fill: s.onSurface, spacing: 0.1 })
    svg += text(x, yy + 122, `${r} dp, Material ${m}`, { size: 12, fill: s.onSurfaceVariant, spacing: 0.4 })
  })
  svg += text(16 + 2 * 132, y + 150 + 30, "Fill: Gamme", { size: 12, fill: s.onSurfaceVariant })
  svg += text(16 + 2 * 132, y + 150 + 48, "Dashed: Material", { size: 12, fill: s.onSurfaceVariant })
  return { svg, h: 150 + 128 }
})

// Spacing: where a group's edges fall, as guides from the screen edge
files["spacing.svg"] = panels("Spacing: a settings group, measured", [{ scheme: light }], (s, y) => {
  const top = y + 8
  const g = group(s, top + 4, "Group heading", [
    { glyph: "wifi", title: "Title", detail: "Detail line" },
    { slot: true, title: "No glyph: the slot stays" },
  ])
  const ink = s.primary
  let guides = ""
  for (const x of [16, 32, 56, 72]) {
    guides += `<path d="M${x} ${top + 14}V${top + 4 + g.h + 6}" stroke="${ink}" stroke-width="1" stroke-dasharray="3 3"/>`
    guides += text(x, top + 8, String(x), { size: 11, weight: 600, fill: ink, anchor: "middle" })
  }
  const rowTop = top + 4 + 52
  const right = (yy, label) => text(W - 24, yy, label, { size: 11, weight: 500, fill: ink, anchor: "end" })
  let notes = right(rowTop + 20, "radius 20") + right(rowTop + 40, "68: two lines") + right(rowTop + 68 + 2 + 33, "56: one line")
  const ly = top + 4 + g.h + 26
  const legend = [
    "16  the card's inset from the screen edge",
    "32  the heading, and every row's glyph",
    "56  the glyph slot ends (24 dp)",
    "72  text starts: 56 from the card's edge",
    "Rows sit 2 dp apart; the gap is transparent.",
  ].map((l, i) => text(16, ly + i * 18, l, { size: 12, fill: s.onSurface })).join("")
  return { svg: g.svg + guides + notes + legend, h: 4 + g.h + 26 + 5 * 18 }
})

// Motion: the four springs, simulated from damping and stiffness
const spring = (zeta, k) => (t) => {
  const w0 = Math.sqrt(k)
  if (zeta >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  const wd = w0 * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
}
const springs = [
  ["press()", spring(1, 10000), ""],
  ["settle()", spring(1, 800), "6 4"],
  ["snappy()", spring(0.8, 600), "2 3"],
  ["bouncy()", spring(0.6, 400), "10 3 2 3"],
]
files["motion-springs.svg"] = panels("GammeMotion: the four springs, 0 to 600 ms", both, (s, y) => {
  const x0 = 48, x1 = W - 96, top = y + 8, bottom = y + 208
  const yOf = (v) => bottom - (v / 1.2) * (bottom - top)
  let svg = `<path d="M${x0} ${top}V${bottom}H${x1}" stroke="${s.outline}" fill="none"/>`
  svg += `<path d="M${x0} ${yOf(1)}H${x1}" stroke="${s.outlineVariant}" stroke-dasharray="2 3"/>`
  svg += text(x0 - 6, yOf(1) + 4, "1", { size: 11, fill: s.onSurfaceVariant, anchor: "end" })
  svg += text(x0 - 6, bottom + 4, "0", { size: 11, fill: s.onSurfaceVariant, anchor: "end" })
  for (const ms of [0, 200, 400, 600]) {
    const x = x0 + (ms / 600) * (x1 - x0)
    svg += text(x, bottom + 18, `${ms}`, { size: 11, fill: s.onSurfaceVariant, anchor: "middle" })
  }
  springs.forEach(([name, f, dash], i) => {
    let d = ""
    for (let ms = 0; ms <= 600; ms += 4) d += `${ms ? "L" : "M"}${(x0 + (ms / 600) * (x1 - x0)).toFixed(1)} ${yOf(f(ms / 1000)).toFixed(1)}`
    svg += `<path d="${d}" fill="none" stroke="${i === 0 ? s.onSurfaceVariant : s.primary}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    const ly = top + 14 + i * 22
    svg += `<path d="M${x1 + 8} ${ly - 4}h24" stroke="${i === 0 ? s.onSurfaceVariant : s.primary}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    svg += text(x1 + 36, ly, name, { size: 11, fill: s.onSurface })
  })
  svg += text(x0, bottom + 38, "Each line is the spring's step response; dashes tell them apart.", { size: 11, fill: s.onSurfaceVariant })
  return { svg, h: 248 }
})

// Glyphs
const glyphSet = [
  ["gamme_check", "check"], ["gamme_check_circle", "check_circle"], ["gamme_ring", "ring"], ["gamme_sync", "sync"],
  ["gamme_moon", "moon"], ["gamme_warning", "warning"], ["gamme_ring_dashed", "ring_dashed"], ["gamme_chevron_end", "chevron_end"],
]
files["glyphs.svg"] = panels("The kit's glyphs, Material Symbols Rounded", both, (s, y) => {
  let svg = ""
  glyphSet.forEach(([n, g], i) => {
    const col = i % 2, line = Math.floor(i / 2)
    const x = 16 + col * 196, yy = y + line * 56
    svg += `<rect x="${x}" y="${yy}" width="48" height="48" rx="12" fill="${s.surfaceContainer}"/>`
    svg += glyph(g, x + 12, yy + 12, 24, g === "ring_dashed" ? s.outline : s.onSurfaceVariant)
    svg += text(x + 60, yy + 29, n, { size: 13, fill: s.onSurface })
  })
  return { svg, h: 4 * 56 - 8 }
})

// Colour roles with their contrast, checked against the floor
const pairs = [
  ["primary", "onPrimary", "On", 4.5],
  ["secondaryContainer", "onSecondaryContainer", "Selected", 4.5],
  ["inverseSurface", "inverseOnSurface", "The action", 4.5],
  ["primaryContainer", "onPrimaryContainer", "Emphasis", 4.5],
  ["surface", "onSurface", "The ground", 4.5],
  ["surfaceContainer", "onSurface", "A group or card", 4.5],
  ["surfaceContainerHigh", "onSurfaceVariant", "A quiet control", 4.5],
  ["surfaceContainer", "onSurfaceVariant", "Quiet text", 4.5],
  ["surface", "outline", "A boundary (3:1)", 3],
  ["surfaceContainer", "error", "Destructive", 4.5],
]
files["colour-roles.svg"] = panels("Colour roles: Material 3 baseline values", both, (s, y) => {
  let svg = ""
  pairs.forEach(([bg, fg, meaning, floor], i) => {
    const yy = y + i * 56
    const ratio = contrast(s[bg], s[fg])
    if (ratio < floor) throw new Error(`${s.name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, under ${floor}:1`)
    svg += `<rect x="16" y="${yy}" width="96" height="48" rx="12" fill="${s[bg]}" stroke="${s.outlineVariant}"/>`
    svg += fg === "outline"
      ? `<rect x="32" y="${yy + 12}" width="64" height="24" rx="6" fill="none" stroke="${s[fg]}" stroke-width="2"/>`
      : text(64, yy + 31, "Aa", { size: 18, weight: 500, fill: s[fg], anchor: "middle" })
    svg += text(124, yy + 18, meaning, { size: 14, weight: 500, fill: s.onSurface, spacing: 0.1 })
    svg += text(W - 16, yy + 18, `${ratio.toFixed(1)}:1, ${floor === 3 ? "passes 3:1" : "passes AA"}`, { size: 12, weight: 500, fill: s.onSurface, anchor: "end" })
    svg += text(124, yy + 37, `${fg} on ${bg}`, { size: 11, fill: s.onSurfaceVariant })
  })
  return { svg, h: pairs.length * 56 - 8 }
})

// Do and don't, for the rulings
const doDont = (title, draw) =>
  panels(title, [
    { scheme: light, label: "Do", glyph: "check_circle" },
    { scheme: light, label: "Don't", glyph: "block", dashed: true },
  ], draw)

files["do-plain-glyphs.svg"] = doDont("Row glyphs: plain, never on a tile", (s, y, p) =>
  group(s, y, null, [
    { glyph: "wifi", tile: p.label !== "Do", title: "Wi-Fi only", detail: "Plain 24 dp glyph in onSurfaceVariant" },
    { glyph: "notifications", tile: p.label !== "Do", title: "Notifications" },
  ]))

files["do-say-why.svg"] = doDont("A disabled row says why", (s, y, p) =>
  group(s, y, null, [
    p.label === "Do"
      ? { glyph: "notifications", title: "Notify when done", unavailable: "Notifications are off for this app", switch: false }
      : { glyph: "notifications", title: "Notify when done", detail: "Notifications are off for this app", faded: 0.38, switch: false, noReason: true, unavailable: "Notifications are off for this app" },
  ]))

files["do-selection-mark.svg"] = doDont("Selection never rests on fill alone", (s, y, p) => {
  let x = 16
  let svg = ""
  for (const [l, sel] of [["All", false], ["Work", true], ["Recipes", false]]) {
    const w = p.label === "Do" ? chipWidth(l) : 14 * 2 + width(l, 14, 500)
    svg += p.label === "Do" ? chip(s, x, y, l, sel, w) :
      `<rect x="${x}" y="${y}" width="${w}" height="36" rx="18" fill="${sel ? s.secondaryContainer : s.surfaceContainerHigh}"/>` +
      text(x + w / 2, y + 23, l, { size: 14, weight: 500, fill: sel ? s.onSecondaryContainer : s.onSurfaceVariant, anchor: "middle" })
    x += w + 8
  }
  return { svg, h: 40 }
})

mkdirSync(OUT, { recursive: true })
for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT, name), svg)
console.log(`${Object.keys(files).length} illustrations in docs/illustrations/`)
