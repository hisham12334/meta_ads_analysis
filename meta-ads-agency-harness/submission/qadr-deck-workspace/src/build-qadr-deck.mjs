import fs from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;

const C = {
  ink: "10131A",
  ink2: "171B24",
  paper: "F6F0E6",
  muted: "B9B2A6",
  green: "35D07F",
  amber: "FFB84D",
  red: "FF6B6B",
  blue: "6EA8FE",
  line: "343B4A",
  white: "FFFFFF",
};

const outputPptx = path.resolve("output/output.pptx");
const previewDir = path.resolve("scratch/previews");

await fs.mkdir("output", { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const deck = Presentation.create({
  slideSize: { width: W, height: H },
});

function slide(title) {
  const s = deck.slides.add();
  rect(s, 0, 0, W, H, C.ink, C.ink);
  if (title) {
    addText(s, title, 96, 74, 1320, 92, {
      fontSize: 48,
      bold: true,
      color: C.paper,
    });
    rule(s, 96, 170, 230, C.green, 6);
  }
  return s;
}

function rect(s, left, top, width, height, fill, line = fill, radius = "rect") {
  return s.shapes.add({
    geometry: radius,
    position: { left, top, width, height },
    fill: { type: "solid", color: fill },
    line: { color: line, transparency: line ? 0 : 100, width: 1 },
  });
}

function addText(s, value, left, top, width, height, opts = {}) {
  const box = s.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill: { color: C.ink, transparency: 100 },
    line: { color: C.ink, transparency: 100 },
  });
  box.name = opts.name || value.slice(0, 36);
  box.text = value;
  box.text.fontSize = opts.fontSize ?? 28;
  box.text.color = opts.color ?? C.paper;
  box.text.typeface = opts.typeface ?? "Aptos";
  box.text.bold = Boolean(opts.bold);
  box.text.italic = Boolean(opts.italic);
  box.text.alignment = opts.alignment ?? "left";
  box.text.verticalAlignment = opts.verticalAlignment ?? "top";
  return box;
}

function rule(s, left, top, width, color = C.green, weight = 4) {
  return s.shapes.add({
    geometry: "rect",
    position: { left, top, width, height: weight },
    fill: { type: "solid", color },
    line: { color, transparency: 100 },
  });
}

function vRule(s, left, top, height, color = C.line, weight = 4) {
  return s.shapes.add({
    geometry: "rect",
    position: { left, top, width: weight, height },
    fill: { type: "solid", color },
    line: { color, transparency: 100 },
  });
}

function label(s, value, left, top, width, color = C.green) {
  addText(s, value.toUpperCase(), left, top, width, 30, {
    fontSize: 18,
    bold: true,
    color,
  });
}

function metric(s, value, caption, left, top, width, accent = C.green) {
  addText(s, value, left, top, width, 96, {
    fontSize: 72,
    bold: true,
    color: accent,
  });
  addText(s, caption, left, top + 88, width, 62, {
    fontSize: 24,
    color: C.muted,
  });
}

function pill(s, value, left, top, width, color = C.green) {
  rect(s, left, top, width, 46, C.ink2, color, "roundRect");
  addText(s, value, left + 20, top + 9, width - 40, 30, {
    fontSize: 19,
    bold: true,
    color,
    alignment: "center",
  });
}

function note(s, value, left, top, width, height) {
  rect(s, left, top, width, height, C.ink2, C.line, "roundRect");
  addText(s, value, left + 28, top + 24, width - 56, height - 40, {
    fontSize: 25,
    color: C.paper,
  });
}

function footer(s, value) {
  addText(s, value, 96, 1016, 1450, 30, {
    fontSize: 16,
    color: "767D8A",
  });
}

// 1. Cover
{
  const s = slide();
  label(s, "Real business AI workflow", 116, 92, 520, C.green);
  addText(s, "QADR Fits", 116, 170, 820, 118, {
    fontSize: 92,
    bold: true,
    color: C.paper,
  });
  addText(s, "AI Creative Intelligence Workflow for a one-product hoodie store", 120, 300, 1000, 70, {
    fontSize: 34,
    color: C.muted,
  });

  addText(s, "8", 1240, 180, 280, 180, {
    fontSize: 176,
    bold: true,
    color: C.green,
    alignment: "center",
  });
  addText(s, "add-to-carts from a verified Meta test", 1130, 370, 520, 70, {
    fontSize: 30,
    color: C.paper,
    alignment: "center",
  });
  rule(s, 1110, 468, 560, C.amber, 5);
  addText(s, "₹270.06 spent · 99 link clicks · 3 initiated checkouts · 1 add-payment-info event", 275, 760, 1370, 46, {
    fontSize: 34,
    bold: true,
    color: C.paper,
    alignment: "center",
  });
  addText(s, "No purchase or ROAS is claimed because Meta returned no purchase event.", 452, 825, 1010, 36, {
    fontSize: 22,
    color: C.muted,
    alignment: "center",
  });
  footer(s, "Verified via Meta Ads MCP on May 9, 2026 · Account: QADR2");
}

// 2. Business and constraint
{
  const s = slide("The business was small enough to be real");
  addText(s, "QADR Fits is a single-product hoodie store selling in India. The launch was constrained by inventory, deadline, and budget.", 100, 220, 1250, 98, {
    fontSize: 36,
    color: C.paper,
  });
  metric(s, "9", "hoodies left", 126, 420, 360, C.amber);
  metric(s, "₹1,300", "planned total budget", 590, 420, 460, C.green);
  metric(s, "May 6", "stop-before constraint", 1140, 420, 470, C.blue);
  note(s, "This made the strategy sharper: no complex testing matrix, no heavy discounting, and no broad claim about scale. The job was to generate purchase intent without wasting a tiny budget.", 150, 705, 1480, 150);
  footer(s, "Source: owner launch conversation and QADR Fits campaign verification.");
}

// 3. Workflow
{
  const s = slide("The workflow turns context into an approved launch");
  const steps = [
    ["1", "Brand intake", "Store, product, stock, budget, region, assets"],
    ["2", "Offer choice", "Free shipping + real scarcity; avoid heavy discounts"],
    ["3", "Creative plan", "Three stock-scarcity variants, not a bloated test"],
    ["4", "Meta launch", "Sales objective, India, Advantage+ placements"],
    ["5", "Review", "Read-only metrics, winner diagnosis, no fake ROAS"],
  ];
  let x = 112;
  for (const [n, h, b] of steps) {
    addText(s, n, x, 265, 82, 82, { fontSize: 58, bold: true, color: C.green, alignment: "center" });
    rule(s, x + 92, 305, 135, n === "5" ? C.amber : C.line, 4);
    addText(s, h, x, 385, 260, 44, { fontSize: 27, bold: true, color: C.paper });
    addText(s, b, x, 440, 270, 110, { fontSize: 22, color: C.muted });
    x += 350;
  }
  addText(s, "The workflow did not just generate ads. It narrowed the operating decision: what to sell, what not to promise, how much to risk, and what evidence would count.", 188, 740, 1430, 88, {
    fontSize: 34,
    bold: true,
    color: C.paper,
    alignment: "center",
  });
  footer(s, "Harness files: BRAND_INTAKE_QUESTIONNAIRE.md, STRATEGY_OUTPUT_TEMPLATE.md, HUMAN_APPROVAL_POLICY.md");
}

// 4. Builder stack
{
  const s = slide("Five layers, not a 30-second prompt");
  const rows = [
    ["LLM", "Reasoning engine", "Synthesizes store context, constraints, campaign structure, and copy."],
    ["MCP", "Hands", "Read-only Meta Ads connector pulls account, campaign, ad set, ad, daily, and pacing metrics."],
    ["Skills", "Judgment", "Competitor, Shopify, offer, Meta Ads, CRO, analytics, and local ad-creative skill."],
    ["Evals", "Taste check", "Judge loop scores avatar specificity, hook, offer clarity, proof, Meta fit, and guardrails."],
    ["Guardrails", "Safety line", "No autonomous spend; publishing, pausing, targeting, and budgets need owner approval."],
  ];
  let y = 230;
  for (const [k, h, b] of rows) {
    addText(s, k, 132, y, 130, 42, { fontSize: 26, bold: true, color: C.green });
    addText(s, h, 310, y, 330, 42, { fontSize: 28, bold: true, color: C.paper });
    addText(s, b, 700, y, 980, 42, { fontSize: 24, color: C.muted });
    rule(s, 132, y + 58, 1500, C.line, 2);
    y += 116;
  }
  footer(s, "Code: meta-ads-mcp/src/server.js, src/metaClient.js, src/intelligence.js · Tests: 248 passing");
}

// 5. Pre-launch decision
{
  const s = slide("The launch recommendation matched the constraints");
  addText(s, "Sales objective. India. One clean campaign. Three ads. Free shipping plus real scarcity.", 126, 230, 1080, 122, {
    fontSize: 52,
    bold: true,
    color: C.paper,
  });
  const decisions = [
    ["Campaign", "META_Sales_India_QADR-Hoodie_Last9Stock_May"],
    ["Ad set", "India_18-34_Broad_WebsitePurchase_Last9"],
    ["Offer", "Free Shipping + Limited 9 Pieces Only"],
    ["Creative", "Stock-scarcity variants; front photo, fit/model, short video"],
  ];
  let y = 445;
  for (const [k, v] of decisions) {
    label(s, k, 138, y + 4, 210, C.amber);
    addText(s, v, 360, y, 1110, 38, { fontSize: 27, color: C.paper });
    y += 88;
  }
  note(s, "The key judgment: with only 9 units, do not over-optimize or discount aggressively. Let the campaign test whether scarcity creates purchase intent.", 1250, 230, 470, 390);
  footer(s, "Pre-launch conversation supplied by owner.");
}

// 6. Verified Meta result
{
  const s = slide("Verified result: purchase intent, not claimed revenue");
  const funnel = [
    ["1,297", "impressions", 1450],
    ["99", "link clicks", 980],
    ["53", "landing page views", 760],
    ["8", "add-to-carts", 520],
    ["3", "initiated checkouts", 350],
    ["1", "add payment info", 220],
  ];
  let y = 230;
  for (const [value, textValue, width] of funnel) {
    rect(s, 150, y, width, 54, value === "8" ? C.green : value === "1" ? C.amber : C.ink2, C.line, "roundRect");
    addText(s, value, 180, y + 9, 160, 32, { fontSize: 30, bold: true, color: value === "8" ? C.ink : C.paper });
    addText(s, textValue, 360, y + 12, 520, 30, { fontSize: 23, color: value === "8" ? C.ink : C.muted });
    y += 92;
  }
  metric(s, "₹270.06", "verified spend", 1280, 272, 390, C.green);
  metric(s, "7.17%", "CTR", 1280, 482, 390, C.amber);
  metric(s, "₹33.76", "cost per add-to-cart", 1280, 692, 430, C.blue);
  footer(s, "Meta did not return purchase events or purchase value, so no sale or ROAS is claimed.");
}

// 7. Ad-level winner
{
  const s = slide("The winning ad was exactly the planned angle");
  addText(s, "Stock Scarcity - Copy drove 7 of 8 add-to-carts, all 3 initiated checkouts, and the only add-payment-info event.", 110, 220, 1330, 96, {
    fontSize: 42,
    bold: true,
    color: C.paper,
  });
  const headers = ["Ad", "Spend", "Link clicks", "ATC", "Checkout", "CTR"];
  const rows = [
    ["Stock Scarcity - Copy", "₹152.97", "54", "7", "3", "6.17%"],
    ["Stock Scarcity - Copy 2", "₹104.80", "37", "1", "0", "10.12%"],
    ["Stock Scarcity", "₹12.29", "8", "0", "0", "5.65%"],
  ];
  const left = 130;
  const top = 405;
  const col = [540, 180, 210, 120, 170, 150];
  let x = left;
  for (let i = 0; i < headers.length; i++) {
    addText(s, headers[i], x, top, col[i], 36, { fontSize: 19, bold: true, color: C.green });
    x += col[i];
  }
  rule(s, left, top + 46, 1370, C.line, 2);
  let y = top + 78;
  for (let r = 0; r < rows.length; r++) {
    x = left;
    if (r === 0) rect(s, left - 20, y - 14, 1410, 62, "14251D", C.green, "roundRect");
    for (let i = 0; i < rows[r].length; i++) {
      addText(s, rows[r][i], x, y, col[i], 34, {
        fontSize: i === 0 ? 24 : 23,
        bold: r === 0,
        color: r === 0 ? C.paper : C.muted,
      });
      x += col[i];
    }
    y += 92;
  }
  note(s, "The ad did not prove revenue, but it did prove the recommended scarcity angle produced deeper-funnel actions.", 1010, 765, 610, 125);
  footer(s, "Ad-level data verified via get_ad_insights for May 3-May 6, 2026.");
}

// 8. LLM judge loop
{
  const s = slide("The judge loop improved the creative before launch");
  addText(s, "The first copy was acceptable but generic. The judge forced the offer and brand meaning into the first read.", 110, 216, 1200, 70, {
    fontSize: 34,
    color: C.paper,
  });
  addText(s, "29/40", 205, 382, 260, 88, { fontSize: 72, bold: true, color: C.red, alignment: "center" });
  addText(s, "first output", 205, 474, 260, 30, { fontSize: 21, color: C.muted, alignment: "center" });
  rule(s, 505, 430, 520, C.line, 5);
  addText(s, "36/40", 1070, 382, 260, 88, { fontSize: 72, bold: true, color: C.green, alignment: "center" });
  addText(s, "improved output", 1070, 474, 260, 30, { fontSize: 21, color: C.muted, alignment: "center" });
  note(s, "Critique: hook was clear but generic; it missed free shipping and QADR's meaning. Regenerate with real scarcity, offer clarity, and no invented proof.", 160, 610, 650, 180);
  note(s, "Improved hook: Only 9 QADR hoodies left. Free shipping on this limited drop. QADR means everything has its timing.", 955, 610, 650, 180);
  footer(s, "Rubric criteria: avatar, competitor angle, hook, offer clarity, proof, Meta fit, guardrails, business value.");
}

// 9. Guardrails
{
  const s = slide("The workflow is autonomous in judgment, not spend");
  addText(s, "Allowed", 140, 240, 340, 54, { fontSize: 44, bold: true, color: C.green });
  addText(s, "Analyze performance\nDraft offers and ads\nRecommend budget and structure\nFlag spend and tracking risk", 140, 325, 690, 220, {
    fontSize: 30,
    color: C.paper,
  });
  addText(s, "Requires approval", 1010, 240, 520, 54, { fontSize: 44, bold: true, color: C.amber });
  addText(s, "Publishing ads\nPausing campaigns\nChanging budgets\nEditing targeting or placements\nChanging live offer pages", 1010, 325, 720, 250, {
    fontSize: 30,
    color: C.paper,
  });
  vRule(s, 930, 230, 460, C.line, 5);
  note(s, "Guardrail lesson from this run: schedule validation should be stricter. The recommendation said stop before May 6 IST; Meta showed a May 6 22:00 UTC end time, though no spend was returned after May 5.", 205, 740, 1370, 135);
  footer(s, "Harness: HUMAN_APPROVAL_POLICY.md");
}

// 10. Landing
{
  const s = slide("What this proves");
  addText(s, "This is a Level 2 builder artifact: it connects tools, judgment, evals, and guardrails to a real commerce outcome signal.", 120, 225, 1370, 116, {
    fontSize: 48,
    bold: true,
    color: C.paper,
  });
  const points = [
    ["Real business", "QADR Fits, one hoodie product, India, 9 units left."],
    ["Real workflow", "Intake -> offer -> creative -> Meta launch -> MCP review."],
    ["Real evidence", "₹270.06 spent, 8 ATCs, 3 checkouts, 1 payment-info event."],
    ["Honest boundary", "No sale or ROAS claimed without purchase event evidence."],
  ];
  let y = 440;
  for (const [h, b] of points) {
    label(s, h, 150, y + 4, 280, C.green);
    addText(s, b, 455, y, 1030, 40, { fontSize: 29, color: C.paper });
    y += 94;
  }
  addText(s, "Next proof step: pair Meta intent data with Shopify order evidence or founder WhatsApp confirmation.", 188, 890, 1390, 50, {
    fontSize: 31,
    bold: true,
    color: C.amber,
    alignment: "center",
  });
  footer(s, "Project path: meta-ads-agency-harness");
}

const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(outputPptx);

for (const s of deck.slides.items) {
  const png = await s.export();
  const buffer = Buffer.from(await png.arrayBuffer());
  const slideNo = String(s.index + 1).padStart(2, "0");
  await fs.writeFile(path.join(previewDir, `slide-${slideNo}.png`), buffer);
}

console.log(JSON.stringify({
  pptx: outputPptx,
  previews: previewDir,
  slideCount: deck.slides.items.length,
}, null, 2));
