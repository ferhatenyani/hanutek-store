import { route } from "@/server/lib/http";
import { adminReviewQuery } from "@/server/validation";
import { adminListReviews } from "@/server/services/admin-content";

export const GET = route({ auth: { permission: "reviews:moderate" } }, async (ctx) => adminListReviews(ctx.query(adminReviewQuery)));
