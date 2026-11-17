"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { categoryBySlug, variantPrice, type Product } from "@/lib/products";
import { cn, formatPrice } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { ProductMorph } from "@/components/nav-transition";
import { Badge } from "@/components/ui/primitives";

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
  const { addToCart } = useStore();
  const toast = useToast();
  const price = variantPrice(product, product.variants[0].id);
  const category = categoryBySlug[product.category];

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.slug, product.variants[0].id);
    toast(`${product.name} added to cart`);
  };

  const imagery = (
    <div className="relative aspect-square before:pointer-events-none before:absolute before:inset-0 before:z-10 before:bg-no-repeat before:content-[''] before:[background-image:linear-gradient(-45deg,transparent_60%,rgba(255,255,255,0.5)_70%,transparent_100%)] before:[background-size:250%_250%] before:[background-position:-100%_-100%] before:transition-[background-position] before:duration-700 before:ease-in-out group-hover:before:[background-position:100%_100%]">
      <Image
        src={product.image}
        alt={product.name}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045]"
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/products/${product.slug}`}
        transitionTypes={["nav-forward"]}
        className="group block"
        aria-label={product.name}
      >
        <div className="relative overflow-hidden rounded-card border border-line bg-surface transition-colors duration-300 group-hover:border-foreground/25">
          {morph ? <ProductMorph slug={product.slug}>{imagery}</ProductMorph> : imagery}

          {product.badge && (
            <div className="absolute top-3 left-3">
              <Badge tone={product.badge === "New" ? "volt" : product.badge === "Sale" ? "danger" : "dark"}>
                {product.badge}
              </Badge>
            </div>
          )}

          <button
            type="button"
            onClick={quickAdd}
            aria-label={`Add ${product.name} to cart`}
            className={cn(
              "absolute right-3 bottom-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-all duration-300",
              "hover:bg-accent hover:text-white active:scale-90",
              "md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100",
            )}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="mt-3 px-0.5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">{category.name}</p>
          <h3 className="mt-1 text-sm leading-snug font-medium text-foreground">{product.name}</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-sm text-foreground">{formatPrice(price)}</span>
            {product.compareAt && (
              <span className="font-mono text-xs text-faint line-through">{formatPrice(product.compareAt)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}