"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Heart, Plus, ShoppingBag, Star } from "lucide-react";
import type { ProductDTO } from "@/lib/api-types";
import { tr, useCategoryLabel } from "@/lib/catalog-client";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { ProductMorph, rememberCardImage, setMorphTarget, warmHeroImage } from "@/components/product-morph";
import { Badge } from "@/components/ui/primitives";
import { Rating } from "@/components/ui/rating";

/*
 * One card, two designs.
 *
 * Desktop (lg+) is the bordered card: image, category, name, stars, price and a
 * full-width add button. Its classes are the unprefixed ones below and must not
 * change.
 *
 * Phones and tablets (< lg) use every `max-lg:` class plus the `lg:hidden`
 * elements: a borderless tinted tile (the white-background product shots are
 * multiplied onto it, so the product floats), with the price and a round add
 * button docked on the tile's bottom edge, in thumb reach. Name and a compact
 * rating · options line sit under it. The card is a size container, so the
 * same markup scales from ~150px phone-grid cells up to ~300px rail cards and
 * tablet columns (@[13rem] / @[14rem] / @[16rem] steps), instead of following
 * the viewport.
 *
 * Price and the add button exist twice (one per design, the other hidden with
 * display:none) because the dock needs them inside the tile, and the image
 * must never be duplicated (it carries the shared-element morph name).
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductDTO;
  priority?: boolean;
}) {
  const { addToCart, toggleFavorite, isFavorite, cart } = useStore();
  const toast = useToast();
  const { t, m, price: fmt, locale } = useI18n();
  const catLabel = useCategoryLabel(locale, m.categories);
  const [added, setAdded] = useState(false);

  const price = product.price;
  const onSale = product.compareAt != null && product.compareAt > price;
  const pct = onSale ? Math.round((1 - price / product.compareAt!) * 100) : 0;
  const fav = isFavorite(product.slug);
  const inCart = cart.lines.reduce((n, l) => (l.slug === product.slug ? n + l.qty : n), 0);
  const short = tr(product.short, locale);
  // quick add takes the first purchasable option
  const quickVariant = product.variants.find((v) => v.inStock);
  const options = product.variants.length;

  const quickAdd = () => {
    if (!quickVariant) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
    addToCart(quickVariant.id).then(
      () => toast(t("cart.added", { name: product.name })),
      () => {
        setAdded(false);
        toast(m.common.actionFailed);
      },
    );
  };

  const toggleFav = () => toggleFavorite(product.slug);
  const favLabel = t(fav ? "favorites.removeAria" : "favorites.addAria", { name: product.name });
  const addLabel = `${t("common.addToCart")} — ${product.name}`;

  const badges: React.ReactNode[] = [];
  if (onSale) badges.push(<Badge key="sale" tone="sale"><span dir="ltr">−{pct}%</span></Badge>);
  if (product.isNew) badges.push(<Badge key="new" tone="volt">{t("common.new")}</Badge>);
  else if (product.bestSeller) badges.push(<Badge key="best" tone="dark">{t("common.bestSeller")}</Badge>);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors duration-150 hover:border-faint",
        "max-lg:@container max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent",
      )}
    >
      <Link
        href={`/products/${product.slug}`}
        transitionTypes={["nav-forward"]}
        onClick={(e) => {
          rememberCardImage(product.slug, e.currentTarget);
          setMorphTarget(product.slug);
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && warmHeroImage(product.image, true)}
        onPointerDown={() => warmHeroImage(product.image)}
        onFocus={() => warmHeroImage(product.image)}
        className="group/tile block focus-visible:outline-none"
        aria-label={product.name}
      >
        <div
          className={cn(
            "relative aspect-square overflow-hidden",
            "max-lg:rounded-[18px] max-lg:transition-transform max-lg:duration-200 max-lg:ease-out-quint",
            "max-lg:group-active/tile:scale-[0.985] max-lg:group-focus-visible/tile:outline-2 max-lg:group-focus-visible/tile:outline-offset-2 max-lg:group-focus-visible/tile:outline-accent",
          )}
        >
          {/* inner radius = card radius − 1px border; the card clips the top.
              Below lg the tint lives on the morph wrapper itself, so the
              multiply blend stays intact while the wrapper is a named
              (isolated) view-transition group. */}
          <ProductMorph
            slug={product.slug}
            variant="card"
            className="rounded-t-[13px] max-lg:rounded-[18px] max-lg:bg-[#f3f3ef]"
          >
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 32vw, (min-width: 40rem) 32vw, 70vw"
              className="object-cover max-lg:mix-blend-multiply"
            />
          </ProductMorph>
          {badges.length > 0 && (
            <div className="absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5 max-lg:start-2.5 max-lg:top-[0.8rem] max-lg:gap-1">
              {badges.slice(0, 2)}
            </div>
          )}

          {/* < lg: price docked on the tile, beside the add button */}
          <div
            className={cn(
              "absolute bottom-2 start-2 z-10 flex max-w-[calc(100%-3.75rem)] flex-col rounded-xl bg-surface/90 px-2.5 py-1.5 backdrop-blur-md lg:hidden",
              "shadow-[0_1px_2px_rgba(20,24,20,0.06),0_4px_14px_rgba(20,24,20,0.08)]",
              "@max-[10rem]:bottom-1.5 @max-[10rem]:start-1.5 @max-[10rem]:max-w-[calc(100%-3.25rem)] @max-[10rem]:px-2",
              "@[13rem]:bottom-2.5 @[13rem]:start-2.5 @[13rem]:max-w-[calc(100%-4.5rem)] @[13rem]:px-3",
              // inline price + struck price only once the card is wide enough to hold both
              "@[17rem]:bottom-[0.95rem] @[17rem]:flex-row @[17rem]:items-baseline @[17rem]:gap-1.5",
            )}
          >
            {onSale && (
              <span
                dir="ltr"
                className="num order-first mb-0.5 truncate text-[10px] leading-none text-faint line-through @[13rem]:text-[11px] @[17rem]:order-last @[17rem]:mb-0"
              >
                {fmt(product.compareAt!)}
              </span>
            )}
            <span
              dir="ltr"
              className={cn(
                "num truncate font-display text-[14.5px] font-bold leading-tight @max-[10rem]:text-[13px] @[16rem]:text-[16px]",
                onSale ? "text-sale-ink" : "text-foreground",
              )}
            >
              {fmt(price)}
            </span>
          </div>
        </div>
        <div className="px-3.5 pt-3 sm:px-4 max-lg:px-1! max-lg:pt-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal max-lg:hidden max-lg:@[14rem]:mb-1 max-lg:@[14rem]:block">
            {catLabel(product.category)}
          </p>
          <h3
            dir="ltr"
            className={cn(
              "mt-1 line-clamp-1 text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere] rtl:text-right",
              "max-lg:mt-0 max-lg:line-clamp-2 max-lg:min-h-[2.6em] max-lg:text-[13.5px] max-lg:leading-[1.3] max-lg:tracking-[-0.005em]",
              "max-lg:@[14rem]:min-h-0 max-lg:@[14rem]:line-clamp-1 max-lg:@[14rem]:text-[15px] max-lg:@[16rem]:text-[16px]",
            )}
          >
            {product.name}
          </h3>
          {/* tablets and wide rail cards: room for the one-line pitch */}
          <p className="mt-0.5 hidden text-[12.5px] leading-snug text-muted max-lg:@[14rem]:line-clamp-1">{short}</p>
          <div className="mt-1.5 max-lg:hidden">
            <Rating value={product.rating} count={product.reviews} size={13} />
          </div>
          {/* < lg: compact proof line — rating, review count, how many options */}
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] leading-none text-faint lg:hidden @[14rem]:mt-2 @[14rem]:text-[12px]">
            <span className="inline-flex items-center gap-1" role="img" aria-label={`${product.rating.toFixed(1)} / 5, ${product.reviews} ${t("common.reviews")}`}>
              <Star size={11} strokeWidth={0} fill="currentColor" className="text-foreground" aria-hidden />
              <span className="num font-semibold text-foreground" aria-hidden>{product.rating.toFixed(1)}</span>
              <span className="num" aria-hidden>({product.reviews})</span>
            </span>
            {options > 1 && (
              <>
                <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-faint/50" />
                <span className="truncate">{t("common.options", { n: options })}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleFav}
        aria-label={favLabel}
        aria-pressed={fav}
        className={cn(
          "absolute end-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface/95 shadow-sm transition-colors duration-150 hover:border-faint",
          "max-lg:end-2 max-lg:top-2 max-lg:size-8 max-lg:border-0 max-lg:bg-surface/85 max-lg:shadow-none max-lg:backdrop-blur-md",
          "max-lg:transition-transform max-lg:duration-200 max-lg:ease-out-quint max-lg:active:scale-90",
          "max-lg:after:absolute max-lg:after:-inset-2 max-lg:after:content-['']",
          "max-lg:@[14rem]:end-2.5 max-lg:@[14rem]:top-2.5 max-lg:@[14rem]:size-9",
        )}
      >
        <Heart size={15} className={cn("transition-colors duration-150", fav ? "fill-sale text-sale" : "text-muted")} />
      </button>

      {/* < lg: round add button docked on the tile's bottom-end corner.
          100cqw = card width = tile height (square tile, no card padding). */}
      <button
        type="button"
        onClick={quickAdd}
        disabled={!quickVariant}
        aria-label={!quickVariant ? `${t("common.soldOut")} — ${product.name}` : inCart > 0 ? `${addLabel} (${t("common.inCartCount", { n: inCart })})` : addLabel}
        className={cn(
          "absolute end-2 top-[calc(100cqw-3rem)] z-10 grid size-10 cursor-pointer place-items-center rounded-full lg:hidden disabled:cursor-not-allowed disabled:opacity-50",
          "shadow-[0_2px_6px_rgba(20,24,20,0.18),0_8px_20px_rgba(20,24,20,0.14)]",
          "transition-[transform,background-color,color] duration-200 ease-out-quint active:scale-90",
          "after:absolute after:-inset-1 after:content-['']",
          "@max-[10rem]:end-1.5 @max-[10rem]:top-[calc(100cqw-2.625rem)] @max-[10rem]:size-9",
          "@[13rem]:end-2.5 @[13rem]:top-[calc(100cqw-3.375rem)] @[13rem]:size-11",
          added ? "bg-volt text-foreground" : "bg-accent text-white",
        )}
      >
        {added ? <Check size={18} strokeWidth={2.5} /> : <ShoppingBag size={17} strokeWidth={2} className="@max-[10rem]:size-4" />}
        {inCart > 0 && !added && (
          <span
            aria-hidden
            className="num absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-volt px-1 text-[10px] font-bold leading-none text-foreground ring-2 ring-background"
          >
            {inCart > 9 ? "9+" : inCart}
          </span>
        )}
      </button>

      <div className="mt-auto px-3.5 pb-3.5 pt-2.5 sm:px-4 max-lg:hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span dir="ltr" className="num font-display text-[15px] font-bold text-foreground">{fmt(price)}</span>
          {onSale && (
            <span dir="ltr" className="num text-[11px] text-faint line-through">{fmt(product.compareAt!)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={quickAdd}
          disabled={!quickVariant}
          aria-label={quickVariant ? addLabel : `${t("common.soldOut")} — ${product.name}`}
          className={cn(
            "mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-150 active:scale-[0.98]",
            added ? "bg-volt text-foreground" : "bg-accent text-white hover:bg-accent-ink",
          )}
        >
          {added ? <Check size={15} /> : <Plus size={15} />}
          {!quickVariant ? t("common.soldOut") : added ? t("common.added") : t("common.addToCart")}
        </button>
      </div>
    </div>
  );
}
