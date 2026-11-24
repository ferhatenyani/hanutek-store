import { route } from "@/server/lib/http";
import { subscribersCsv } from "@/server/services/admin-content";

export const GET = route({ auth: { permission: "customers:read" } }, async () => {
  return new Response(await subscribersCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="newsletter-subscribers.csv"',
      "cache-control": "no-store",
    },
  });
});
