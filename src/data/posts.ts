import type { ImageMetadata } from "astro";
import raw from "./posts.json";
import { services, type Service } from "./services";

// Copied from the old WordPress blog by homeservices-build/extract_posts.py.
// Re-running the extractor overwrites posts.json and the images in assets/posts.
type RawPost = (typeof raw.posts)[number];

export interface Post extends Omit<RawPost, "image"> {
  categoryName: string;
  image: ImageMetadata | null;
  service: Service | undefined;
}

const images = import.meta.glob<ImageMetadata>("../assets/posts/*", { eager: true, import: "default" });

export const categoryNames: Record<string, string> = raw.categories;

// Old blog category -> the service whose call button an article shows.
const CATEGORY_SERVICE: Record<string, string> = {
  plumbing: "plumbing",
  "leak-repair": "plumbing",
  hvac: "hvac",
  "air-quality": "hvac",
  electrician: "electrical",
  electronic: "electrical",
  mold: "mold-remediation",
  "pest-control": "pest-control",
  "appliance-repair": "appliance-repair",
  "self-storage": "self-storage",
  concrete: "concrete",
};

// Posts in broad categories (emergency, general, uncategorized) get a service from their title.
const TITLE_SERVICE: [RegExp, string][] = [
  [/water damage|flood/i, "water-damage"],
  [/mold|mildew/i, "mold-remediation"],
  [/plumb|pipe|drain|sink|leak|water heater|water pressure/i, "plumbing"],
  [/hvac|\bac\b|air condition|thermostat|furnace|heating/i, "hvac"],
  [/electric|wiring/i, "electrical"],
  [/pest|roach|termite|bug/i, "pest-control"],
  [/appliance|washing machine|fridge|dryer/i, "appliance-repair"],
  [/storage/i, "self-storage"],
  [/concrete|driveway|paving/i, "concrete"],
  [/roof/i, "roofing"],
];

function serviceFor(p: RawPost): Service | undefined {
  const slug = CATEGORY_SERVICE[p.category] ?? TITLE_SERVICE.find(([re]) => re.test(p.title))?.[1];
  return services.find((s) => s.slug === slug);
}

export const posts: Post[] = raw.posts.map((p) => {
  const service = serviceFor(p);
  const own = p.image ? images[`../assets/posts/${p.image}`] : undefined;
  return {
    ...p,
    categoryName: categoryNames[p.category] ?? p.category,
    // Most old posts had no featured image; fall back to the matching service photo.
    image: own ?? service?.featureImage ?? null,
    imageAlt: own ? p.imageAlt : "",
    service,
  };
});

export const postsInCategory = (cat: string) => posts.filter((p) => p.categories.includes(cat));

export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export interface GuidePage {
  data: Post[];
  currentPage: number;
  lastPage: number;
  prev?: string;
  next?: string;
}

// Static paths for a paginated listing at <base>, <base>page/2/, ... (the old WordPress URL scheme).
export function paginatePosts(list: Post[], base: string, perPage = 12) {
  const lastPage = Math.max(1, Math.ceil(list.length / perPage));
  const url = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  return Array.from({ length: lastPage }, (_, i) => {
    const n = i + 1;
    const page: GuidePage = {
      data: list.slice(i * perPage, n * perPage),
      currentPage: n,
      lastPage,
      prev: n > 1 ? url(n - 1) : undefined,
      next: n < lastPage ? url(n + 1) : undefined,
    };
    return { params: { page: n === 1 ? undefined : `page/${n}` }, props: { page } };
  });
}
