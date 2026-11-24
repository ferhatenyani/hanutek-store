import { route } from "@/server/lib/http";
import { notFound } from "@/server/lib/errors";
import { profilePatchSchema } from "@/server/validation";
import { getUserDTO, updateProfile } from "@/server/services/accounts";

export const GET = route({ auth: "required" }, async (ctx) => {
  const user = await getUserDTO(ctx.requireUser().id);
  if (!user) throw notFound("User");
  return { user };
});

export const PATCH = route({ auth: "required" }, async (ctx) => {
  const patch = await ctx.body(profilePatchSchema);
  return { user: await updateProfile(ctx.requireUser().id, patch) };
});
