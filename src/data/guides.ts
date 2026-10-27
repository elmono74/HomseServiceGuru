import lowWaterPressure from "../assets/guides/low-water-pressure-fixes.jpg";
import termiteDamage from "../assets/guides/termite-damage-warning-signs.jpg";
import blackMold from "../assets/guides/black-mold-vs-mildew-differences.jpg";

// Prototype sample: the three newest posts. The full build would load all 134
// posts from Markdown via a content collection.
export const guides = [
  {
    slug: "low-water-pressure-fixes",
    title: "Low Water Pressure Fixes",
    service: "plumbing",
    date: "2026-03-03",
    excerpt:
      "Weak showers and slow sinks rarely need a full plumbing overhaul. Here's how to find the cause and when to call a pro.",
    image: lowWaterPressure,
  },
  {
    slug: "termite-damage-warning-signs",
    title: "Termite Damage Warning Signs",
    service: "pest-control",
    date: "2026-03-01",
    excerpt:
      "Subtle changes in wood, walls or flooring can point to termites. Learn the early signs before the damage spreads.",
    image: termiteDamage,
  },
  {
    slug: "black-mold-vs-mildew-differences",
    title: "Black Mold vs. Mildew Differences",
    service: "mold-remediation",
    date: "2026-02-24",
    excerpt:
      "Not every dark spot is dangerous. How to tell mildew from black mold, and what each means for your home.",
    image: blackMold,
  },
];
