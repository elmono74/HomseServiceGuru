import type { APIRoute } from "astro";
import { services } from "../data/services";
import { categoryNames, paginatePosts, posts, postsInCategory } from "../data/posts";

// /sitemap.xml for search engines: every page on the site except the 404 page.
export const GET: APIRoute = ({ site }) => {
  const listing = (base: string, list: typeof posts) =>
    paginatePosts(list, base).map(({ params }) => (params.page ? `${base}${params.page}/` : base));

  const pages: { path: string; lastmod?: string }[] = [
    { path: "/" },
    { path: "/about-us/" },
    { path: "/contact-us/" },
    { path: "/privacy-policy-3/" },
    { path: "/term-and-conditions/" },
    ...services.map((s) => ({ path: `/services/${s.slug}/` })),
    ...listing("/blog/", posts).map((path) => ({ path })),
    ...Object.keys(categoryNames)
      .filter((c) => postsInCategory(c).length > 0)
      .flatMap((c) => listing(`/category/${c}/`, postsInCategory(c)).map((path) => ({ path }))),
    ...posts.map((p) => ({ path: `/${p.slug}/`, lastmod: p.updated })),
  ];

  const urls = pages
    .map(({ path, lastmod }) => {
      const loc = new URL(path, site).href;
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
