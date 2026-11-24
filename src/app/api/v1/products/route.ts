import { route, json } from "@/server/lib/http";
import { productListQuery } from "@/server/validation";
import { listProducts } from "@/server/services/catalog";

export const GET = route({ auth: "none" }, async (ctx) => {
  const q = ctx.query(productListQuery);
  const data = await listProducts(q);
  return json(data, { headers: { "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } });
});
