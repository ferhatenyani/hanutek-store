import { eq, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import type { Db } from "../client";
import {
  categories,
  categoryTranslations,
  inventoryMovements,
  productImages,
  productTranslations,
  productVariants,
  products,
  promotions,
  users,
  variantTranslations,
} from "../schema";
import { categories as seedCategories, products as seedProducts } from "./catalog-data";
import { productCopyAr, productCopyFr } from "./product-copy";

const CATEGORY_COPY: Record<string, { fr: { name: string; short: string; tagline: string }; ar: { name: string; short: string; tagline: string } }> = {
  vision: {
    fr: { name: "Vision & caméras", short: "Vision", tagline: "Voir plus, conduire serein." },
    ar: { name: "الرؤية والكاميرات", short: "الرؤية", tagline: "رؤية أوضح، قيادة أهدأ." },
  },
  power: {
    fr: { name: "Énergie & démarrage", short: "Énergie", tagline: "Ne restez jamais en panne." },
    ar: { name: "الطاقة والتشغيل", short: "الطاقة", tagline: "لا تبقَ عالقًا أبدًا." },
  },
  interior: {
    fr: { name: "Intérieur & organisation", short: "Intérieur", tagline: "Un habitacle à votre image." },
    ar: { name: "الداخلية والتنظيم", short: "الداخلية", tagline: "مقصورة على ذوقك." },
  },
  care: {
    fr: { name: "Entretien & lavage", short: "Entretien", tagline: "Une voiture toujours nette." },
    ar: { name: "العناية والغسيل", short: "العناية", tagline: "سيارة نظيفة دائمًا." },
  },
};

const STOCK_PER_VARIANT = 25;

/**
 * Idempotent catalogue seed (safe to re-run: existing slugs are skipped).
 * Seeds categories, products, variants, images, translations, the DRIVE10
 * promotion and — when credentials are provided — the first admin account.
 */
export async function seed(db: Db, opts: { adminEmail?: string; adminPassword?: string } = {}) {
  const summary = { categories: 0, products: 0, variants: 0, promotions: 0, admin: false };

  await db.transaction(async (tx) => {
    const catIds = new Map<string, string>();
    for (const [i, c] of seedCategories.entries()) {
      const [existing] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, c.slug));
      let id = existing?.id;
      if (!id) {
        [{ id }] = await tx.insert(categories).values({ slug: c.slug, position: i, image: c.image }).returning({ id: categories.id });
        const copy = CATEGORY_COPY[c.slug];
        await tx.insert(categoryTranslations).values([
          { categoryId: id, locale: "fr", ...copy.fr },
          { categoryId: id, locale: "ar", ...copy.ar },
        ]);
        summary.categories++;
      }
      catIds.set(c.slug, id);
    }

    for (const [i, p] of seedProducts.entries()) {
      const [existing] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, p.slug));
      if (existing) continue;
      const fr = productCopyFr[p.slug];
      const ar = productCopyAr[p.slug] ?? fr;
      const [row] = await tx
        .insert(products)
        .values({
          slug: p.slug,
          name: p.name,
          categoryId: catIds.get(p.category)!,
          status: "active",
          isFeatured: p.featured ?? false,
          isBestSeller: p.bestSeller ?? false,
          isNew: p.isNew ?? false,
          position: i,
        })
        .returning({ id: products.id });
      summary.products++;

      await tx.insert(productTranslations).values([
        {
          productId: row.id,
          locale: "fr",
          short: fr?.short ?? p.short,
          description: fr?.description ?? p.description,
          variantTitle: p.variantTitle,
          specs: (fr?.specs ?? p.specs) as [string, string][],
          inTheBox: fr?.inTheBox ?? p.inTheBox,
        },
        {
          productId: row.id,
          locale: "ar",
          short: ar?.short ?? p.short,
          description: ar?.description ?? p.description,
          variantTitle: p.variantTitle,
          specs: (ar?.specs ?? p.specs) as [string, string][],
          inTheBox: ar?.inTheBox ?? p.inTheBox,
        },
      ]);
      await tx.insert(productImages).values({ productId: row.id, url: p.image, alt: p.name, position: 0 });

      for (const [vi, v] of p.variants.entries()) {
        const price = p.price + v.priceDelta;
        const [variant] = await tx
          .insert(productVariants)
          .values({
            productId: row.id,
            code: v.id,
            sku: `${p.slug.split("-").slice(0, 2).join("-")}-${v.id}`.toUpperCase(),
            price,
            compareAtPrice: p.compareAt ? p.compareAt + v.priceDelta : null,
            stock: STOCK_PER_VARIANT,
            position: vi,
          })
          .returning({ id: productVariants.id });
        // Translated option labels; seed copy keys may predate the catalogue ids, so fall back by position.
        const frLabels = Object.values(fr?.variants ?? {});
        const arLabels = Object.values(ar?.variants ?? {});
        await tx.insert(variantTranslations).values([
          { variantId: variant.id, locale: "fr", label: fr?.variants[v.id] ?? frLabels[vi] ?? v.label },
          { variantId: variant.id, locale: "ar", label: ar?.variants[v.id] ?? arLabels[vi] ?? v.label },
        ]);
        await tx.insert(inventoryMovements).values({ variantId: variant.id, delta: STOCK_PER_VARIANT, stockAfter: STOCK_PER_VARIANT, reason: "restock", note: "Seed" });
        summary.variants++;
      }
      await tx.execute(sql`
        update products p set
          min_price = (select min(price) from product_variants v where v.product_id = p.id and v.is_active),
          on_sale = exists (select 1 from product_variants v where v.product_id = p.id and v.compare_at_price > v.price)
        where p.id = ${row.id}`);
    }

    const inserted = await tx
      .insert(promotions)
      .values({ code: "DRIVE10", description: "−10% sur la commande", type: "percent", value: 10, isActive: true })
      .onConflictDoNothing()
      .returning({ id: promotions.id });
    summary.promotions += inserted.length;

    if (opts.adminEmail && opts.adminPassword) {
      const email = opts.adminEmail.trim().toLowerCase();
      const passwordHash = await hash(opts.adminPassword, { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (!existing) {
        await tx.insert(users).values({ email, name: "Admin", passwordHash, role: "admin", emailVerifiedAt: new Date() });
        summary.admin = true;
      }
    }
  });
  return summary;
}
