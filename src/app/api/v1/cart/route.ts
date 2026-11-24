import { route } from "@/server/lib/http";
import { getCart } from "@/server/services/cart";
import { cartOwner } from "@/server/lib/route-helpers";

export const GET = route({ auth: "optional" }, async (ctx) => ({ cart: await getCart(cartOwner(ctx)) }));
