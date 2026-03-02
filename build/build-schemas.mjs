import { JSDOM } from "jsdom";
import { glob } from "glob";
import fs from "fs";
import path from "path";

const EDITABLE = new Set(["h1","h2","h3","h4","h5","h6","p","li","a","button","blockquote","figcaption"]);

function readFile(fp){ return fs.readFileSync(fp, "utf8"); }
function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true}); }

/** Heuristics: infer category from hints (override with data-category if present) */
function inferCategory(doc) {
  const root = doc.body;
  const hint = root.getAttribute("data-category");
  if (hint) return hint;
  if (doc.querySelector('[data-role="pricing"], .pricing, .plan')) return "pricing";
  if (doc.querySelector('[data-role="testimonials"], .testimonial')) return "testimonials";
  if (doc.querySelector('[data-role="faq"], .faq')) return "faq";
  if (doc.querySelector('[data-role="logos"], .logos, .logo-grid')) return "logos";
  if (doc.querySelector('[data-role="stats"], .stats, .kpi, .stat')) return "stats";
  if (doc.querySelector('[data-role="team"], .team')) return "team";
  if (doc.querySelector('[data-role="gallery"], .gallery, .portfolio')) return "gallery";
  if (doc.querySelector("header .nav, nav")) return "nav";
  if (doc.querySelector("footer")) return "footer";
  // default buckets
  if (doc.querySelector("h1")) return "hero";
  return "content";
}

/** Is this node inside an element that denotes a card? */
function inCard(el){
  return el.closest('[data-card], .card, .feature, .plan, .testimonial, .pricing-card');
}

/** Is this node inside a stats list? */
function inStats(el){
  return el.closest('[data-role="stats"], .stats, .kpi, .stat-grid');
}

/** Return a group key to keep paragraphs together by area/column */
function resolveGroup(el){
  const attr = el.closest("[data-group]")?.getAttribute("data-group");
  if (attr) return attr;
  // common two-column hints
  const col = el.closest('.col, .column, .left, .right, [class*="col-"], [class*="grid"]');
  if (col) {
    // stable-ish descriptor
    const cls = (col.className || "").toString().split(/\s+/).slice(0,2).join(".");
    return cls || "col";
  }
  return "main";
}

/** Extract a schema following the flexible spec (arrays, optional fields) */
function extractSchema(html, idHint){
  const dom = new JSDOM(html);
  const d = dom.window.document;
  const category = inferCategory(d);

  const slots = {
    // We’ll fill arrays only if we find nodes—keeps JSON small.
  };

  // Headings & paragraphs grouped
  const headings = [];
  const paragraphs = [];
  const bullets = [];

  // CTA detection
  const ctas = [];

  // Complex buckets to collect and lift later
  const cards = [];        // elements grouped within a card container
  const testimonials = []; // explicit blocks if present
  const plans = [];
  const stats = [];
  const logos = [];
  const team = [];
  const steps = [];
  const items = [];        // gallery/portfolio items

  // Walk editable nodes
  const walker = d.createTreeWalker(d.body, d.defaultView.NodeFilter.SHOW_ELEMENT, null);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tag = el.tagName?.toLowerCase();
    if (!EDITABLE.has(tag)) continue;

    // CTAs
    if (tag === "a" || tag === "button") {
      const kind =
        el.matches('[data-kind="primary"], .btn-primary, .primary') ? "primary" :
        el.matches('[data-kind="secondary"], .btn-secondary, .secondary') ? "secondary" :
        "link";
      ctas.push({ label: "", url: "", kind, priority: ctas.length + 1 });
      continue;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      headings.push({ level, text: "" , group: resolveGroup(el) });
      continue;
    }

    // Paragraphs
    if (tag === "p") {
      paragraphs.push({ text: "", group: resolveGroup(el) });
      continue;
    }

    // List items → could be bullets or stats (heuristic)
    if (tag === "li") {
      if (inStats(el)) {
        stats.push({ label: "", value: "", qualifier: "" });
      } else {
        bullets.push({ text: "", group: resolveGroup(el) });
      }
      continue;
    }

    if (tag === "blockquote") {
      // Might later be part of testimonials if enclosed in a testimonial wrapper.
      // For now treat as paragraph-like copy:
      paragraphs.push({ text: "", group: resolveGroup(el) });
      continue;
    }

    if (tag === "figcaption") {
      paragraphs.push({ text: "", group: resolveGroup(el) });
    }
  }

  // Cards/testimonials/plans/logos/team/items via container detection
  d.querySelectorAll('[data-card], .card, .feature, .pricing-card').forEach(cardEl => {
    cards.push({
      title: "",
      subtitle: "",
      description: "",
      icon: "",
      image_url: "",
      badge: "",
      ctas: []
    });
  });

  d.querySelectorAll('[data-role="testimonial"], .testimonial').forEach(t => {
    testimonials.push({ quote: "", author: "", role: "", company: "", avatar_url: "", rating: null });
  });

  d.querySelectorAll('[data-role="plan"], .plan, .pricing-card').forEach(p => {
    plans.push({
      name: "",
      tagline: "",
      price: "",
      period: "mo",
      features: [],
      badge: "",
      ctas: [{ label: "", url: "", kind: "primary", priority: 1 }]
    });
  });

  d.querySelectorAll('[data-role="logo"], .logo, .logo-item').forEach(l => {
    logos.push({ name: "", logo_url: "" });
  });

  d.querySelectorAll('[data-role="team-member"], .team-member').forEach(m => {
    team.push({ name: "", role: "", bio: "", avatar_url: "", social: {} });
  });

  d.querySelectorAll('[data-role="step"], .step').forEach((s, i) => {
    steps.push({ step_number: i + 1, title: "", description: "" });
  });

  d.querySelectorAll('[data-role="gallery-item"], .gallery-item, .portfolio-item').forEach(it => {
    items.push({ title: "", description: "", image_url: "", video_url: "" });
  });

  // Lift non-empty arrays into slots (keep JSON small)
  if (headings.length) slots.headings = headings.map(({level}) => ({level, text:""}));
  if (paragraphs.length) slots.paragraphs = paragraphs.map(() => ({text:""}));
  if (bullets.length) slots.bullets = bullets.map(() => ({text:""}));
  if (ctas.length) slots.ctas = ctas;
  if (cards.length) slots.cards = cards;
  if (testimonials.length) slots.testimonials = testimonials;
  if (plans.length) slots.plans = plans;
  if (stats.length) slots.stats = stats;
  if (logos.length) slots.logos = logos;
  if (team.length) slots.team = team;
  if (steps.length) slots.steps = steps;
  if (items.length) slots.items = items;

  // Contact form hint (optional)
  const hasForm = d.querySelector("form, [data-role='form'], .newsletter");
  if (hasForm) {
    slots.form = {
      fields: [
        { name:"name", label:"Name", type:"text", required:true, options:[] },
        { name:"email", label:"Email", type:"email", required:true, options:[] },
        { name:"message", label:"Message", type:"textarea", required:false, options:[] }
      ],
      submit_label: "Send",
      success_message: ""
    };
  }

  // Nav/Footer links (very light)
  if (category === "nav") {
    slots.nav_links = Array.from(d.querySelectorAll("nav a")).slice(0,6).map(() => ({label:"", url:""}));
  }
  if (category === "footer") {
    slots.footer_links = Array.from(d.querySelectorAll("footer a")).slice(0,8).map(() => ({label:"", url:""}));
    slots.legal = { company:"", copyright:"" };
    if (d.querySelector(".newsletter, [data-role='newsletter']")) {
      slots.newsletter = { label:"Subscribe", placeholder:"Your email", submit_label:"Join" };
    }
  }

  return {
    version: "1",
    section_id: idHint,
    category,
    slots
  };
}

async function main() {
  const input = "sections/*.html";
  const outDir = "public/js/schemas";
  ensureDir(outDir);

  const files = await glob(input);
  for (const fp of files) {
    const html = readFile(fp);
    const id = path.basename(fp).replace(/\.html$/,"");
    const schema = extractSchema(html, id);
    const out = path.join(outDir, `${id}.schema.json`);
    fs.writeFileSync(out, JSON.stringify(schema, null, 2));
    console.log("✓", out);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
