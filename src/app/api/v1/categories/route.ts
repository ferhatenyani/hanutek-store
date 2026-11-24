import { route, json } from "@/server/lib/http";
import { listCategories } from "@/server/services/catalog";

export const GET = route({ auth: "none" }, async () =>
  json({ items: await listCategories() }, { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }),
);
