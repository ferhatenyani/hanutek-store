import { route, json } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { suggestQuery } from "@/server/validation";
import { suggest } from "@/server/services/catalog";

export const GET = route({ auth: "none", limits: [{ limit: LIMITS.search }] }, async (ctx) => {
  const { q } = ctx.query(suggestQuery);
  return json({ items: await suggest(q) }, { headers: { "cache-control": "public, max-age=30, s-maxage=60" } });
});
