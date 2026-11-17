import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, products, productsInCategory } from "@/lib/products";
import { ProductDetail } from "./detail";
import { ProductCard } from "@/components/product-card";
import { SectionHead } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return { title: product.name, description: product.short };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const related = productsInCategory(product.category)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  return (
    <>
      <ProductDetail product={product} />
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <BlurFade inView>
            <SectionHead eyebrow="Same category" title="Pairs well with" />
          </BlurFade>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-5">
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}