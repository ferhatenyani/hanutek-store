import { z } from "zod";
import { route } from "@/server/lib/http";
import { slug } from "@/server/validation";
import { getProductsBySlugs } from "@/server/services/catalog";

const query = z.object({
  slugs: z
    .string()
    .max(4000)
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(slug).max(200)),
});

/** Batch lookup for client lists keyed by slug (favorites). Only active products are returned. */
export const GET = route({ auth: "none" }, async (ctx) => {
  const { slugs } = ctx.query(query);
  const items = await getProductsBySlugs(slugs);
  return { items, total: items.length, page: 1, pageSize: items.length };
});
