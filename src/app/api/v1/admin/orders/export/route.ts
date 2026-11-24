import { route } from "@/server/lib/http";
import { adminOrderQuery } from "@/server/validation";
import { exportOrdersCsv } from "@/server/services/orders";

export const GET = route({ auth: { permission: "orders:read" } }, async (ctx) => {
  const csv = await exportOrdersCsv(ctx.query(adminOrderQuery));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
});
