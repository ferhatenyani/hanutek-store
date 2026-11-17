"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Heart, Plus } from "lucide-react";
import { motion } from "motion/react";
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
  index = 0,
  priority = false,
  morph = true,
}: {
  product: Product;
  index?: number;
  priority?: boolean;
  /** Shared-element morph source. Only one card per slug per page may enable it. */
  morph?: boolean;
}) {
  const { addToCart, toggleFavorite, isFavorite } = useStore();
  const toast = useToast();
  const { t, m, price: fmt, locale } = useI18n();
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
  const favLabel = fav
    ? locale === "ar" ? `إزالة ${product.name} من المفضلة` : `Retirer ${product.name} des favoris`
    : locale === "ar" ? `إضافة ${product.name} إلى المفضلة` : `Ajouter ${product.name} aux favoris`;

  const badges: React.ReactNode[] = [];
  if (onSale) badges.push(<Badge key="sale" tone="sale"><span dir="ltr">−{pct}%</span></Badge>);
  if (product.isNew) badges.push(<Badge key="new" tone="volt">{t("common.new")}</Badge>);
  else if (product.bestSeller) badges.push(<Badge key="best" tone="dark">{t("common.bestSeller")}</Badge>);

  const imagery = (
    <div className="relative aspect-square overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:z-10 before:bg-no-repeat before:content-[''] before:[background-image:linear-gradient(-45deg,transparent_60%,rgba(255,255,255,0.5)_70%,transparent_100%)] before:[background-size:250%_250%] before:[background-position:-100%_-100%] before:transition-[background-position] before:duration-700 before:ease-in-out group-hover:before:[background-position:100%_100%]">
      <Image
        src={product.image}
        alt={product.name}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-500 ease-out-quint group-hover:scale-[1.045]"
      />
      {badges.length > 0 && (
        <div className="absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5">{badges.slice(0, 2)}</div>
      )}
    </div>
  );

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-quint hover:-translate-y-1 hover:border-faint hover:shadow-lift">
        <Link
          href={`/products/${product.slug}`}
          transitionTypes={["nav-forward"]}
          className="block focus-visible:outline-none"
          aria-label={product.name}
        >
          {morph ? <ProductMorph slug={product.slug}>{imagery}</ProductMorph> : imagery}
          <div className="px-4 pt-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal">
              {m.categories[product.category].name}
            </p>
            <h3 className="mt-1 line-clamp-1 text-sm font-semibold leading-snug text-foreground">{product.name}</h3>
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
          className="absolute end-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface/90 shadow-sm backdrop-blur-sm transition-transform duration-200 before:absolute before:-inset-1 before:content-[''] hover:scale-105 active:scale-90"
        >
          <Heart size={15} className={cn("transition-colors", fav ? "fill-sale text-sale" : "text-muted")} />
        </button>

        <div className="mt-auto px-4 pb-4 pt-2.5">
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
              "transition-[background-color,color,transform] duration-200 ease-out-quint active:scale-[0.98]",
              added ? "bg-volt text-foreground" : "bg-accent text-white hover:bg-accent-ink",
            )}
          >
            {added ? <Check size={15} /> : <Plus size={15} />}
            {added ? t("common.added") : t("common.addToCart")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
