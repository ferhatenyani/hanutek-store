"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Heart, Plus } from "lucide-react";
import { variantPrice, type Product } from "@/lib/products";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { ProductMorph } from "@/components/nav-transition";
import { Badge } from "@/components/ui/primitives";
import { Rating } from "@/components/ui/rating";

export function ProductCard({
  product,
  priority = false,
  morph = false,
}: {
  product: Product;
  priority?: boolean;
  /** Home rails morph their image into the detail hero; listing/favorites push. */
  morph?: boolean;
}) {
  const { addToCart, toggleFavorite, isFavorite } = useStore();
  const toast = useToast();
  const { t, m, price: fmt } = useI18n();
  const [added, setAdded] = useState(false);

  const price = variantPrice(product, product.variants[0].id);
  const onSale = product.compareAt != null && product.compareAt > price;
  const pct = onSale ? Math.round((1 - price / product.compareAt!) * 100) : 0;
  const fav = isFavorite(product.slug);

  const quickAdd = () => {
    addToCart(product.slug, product.variants[0].id);
    toast(t("cart.added", { name: product.name }));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  const toggleFav = () => toggleFavorite(product.slug);
  const favLabel = t(fav ? "favorites.removeAria" : "favorites.addAria", { name: product.name });

  const badges: React.ReactNode[] = [];
  if (onSale) badges.push(<Badge key="sale" tone="sale"><span dir="ltr">−{pct}%</span></Badge>);
  if (product.isNew) badges.push(<Badge key="new" tone="volt">{t("common.new")}</Badge>);
  else if (product.bestSeller) badges.push(<Badge key="best" tone="dark">{t("common.bestSeller")}</Badge>);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors duration-150 hover:border-faint">
      <Link
        href={`/products/${product.slug}`}
        transitionTypes={morph ? ["morph"] : ["nav-forward"]}
        className="block focus-visible:outline-none"
        aria-label={product.name}
      >
        <div className="relative aspect-square overflow-hidden">
          <ProductMorph slug={product.slug}>
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 32vw, (min-width: 40rem) 32vw, 70vw"
              className="object-cover"
            />
          </ProductMorph>
          {badges.length > 0 && (
            <div className="absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5">{badges.slice(0, 2)}</div>
          )}
        </div>
        <div className="px-3.5 pt-3 sm:px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal">
            {m.categories[product.category].name}
          </p>
          <h3 dir="ltr" className="mt-1 line-clamp-1 text-sm font-semibold leading-snug text-foreground rtl:text-right">{product.name}</h3>
          <div className="mt-1.5">
            <Rating value={product.rating} count={product.reviews} size={13} />
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleFav}
        aria-label={favLabel}
        aria-pressed={fav}
        className="absolute end-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface/95 shadow-sm transition-colors duration-150 hover:border-faint"
      >
        <Heart size={15} className={cn("transition-colors duration-150", fav ? "fill-sale text-sale" : "text-muted")} />
      </button>

      <div className="mt-auto px-3.5 pb-3.5 pt-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span dir="ltr" className="num font-display text-[15px] font-bold text-foreground">{fmt(price)}</span>
          {onSale && (
            <span dir="ltr" className="num text-[11px] text-faint line-through">{fmt(product.compareAt!)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={quickAdd}
          aria-label={`${t("common.addToCart")} — ${product.name}`}
          className={cn(
            "mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] font-semibold",
            "transition-colors duration-150 active:scale-[0.98]",
            added ? "bg-volt text-foreground" : "bg-accent text-white hover:bg-accent-ink",
          )}
        >
          {added ? <Check size={15} /> : <Plus size={15} />}
          {added ? t("common.added") : t("common.addToCart")}
        </button>
      </div>
    </div>
  );
}
