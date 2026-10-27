import type { ImageMetadata } from "astro";
import raw from "./services.json";

// Extracted from the old WordPress service pages by homeservices-build/extract_services.py.
type RawService = (typeof raw)[number];

export interface Service extends RawService {
  short: string;
  heroImage: ImageMetadata;
  featureImage: ImageMetadata;
}

const images = import.meta.glob<ImageMetadata>("../assets/services/*", {
  eager: true,
  import: "default",
});

// One-line card blurbs (from the old homepage service cards where they existed).
const SHORT: Record<string, string> = {
  plumbing: "Leaks, clogs, water heaters and burst pipes, fixed fast.",
  hvac: "Heating and cooling repair, tune-ups and installs.",
  electrical: "Local electricians for repairs, wiring and upgrades.",
  "water-damage": "Water extraction, drying and restoration.",
  roofing: "Repairs and replacements that stand up to the weather.",
  "mold-remediation": "Testing and safe removal to protect your home.",
  "pest-control": "Fast, effective treatments for every kind of pest.",
  "appliance-repair": "Washers, fridges, ovens and more, running again.",
  "bathroom-remodeling": "Design and installation for a bathroom you love.",
  "kitchen-remodeling": "Cabinets, counters and full kitchen makeovers.",
  "tree-services": "Trimming, removal and storm cleanup.",
  concrete: "Driveways, patios and walkways built to last.",
  "garage-doors": "Spring, opener and door repair or replacement.",
  septic: "Pumping, inspection and septic repairs.",
  "home-security": "Cameras, alarms and smart-home protection.",
  "self-storage": "Secure, convenient storage close to home.",
};

function image(file: string | undefined): ImageMetadata {
  const match = Object.entries(images).find(([path]) => file && path.endsWith("/" + file));
  if (!match) throw new Error(`Missing service image: ${file}`);
  return match[1];
}

export const services: Service[] = raw.map((s) => ({
  ...s,
  short: SHORT[s.slug] ?? s.intro.split(". ")[0] + ".",
  heroImage: image(s.hero),
  featureImage: image(s.feature),
}));

export const emergencyServices = services.filter((s) => s.emergency);

export function telHref(phone: string) {
  return "tel:+" + phone.replace(/\D/g, "");
}
