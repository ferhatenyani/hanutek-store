import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cachedProduct, cachedRelated } from "@/server/queries";
import { ProductDetail } from "./detail";

// On-demand ISR: pages render from the database on first request, are cached,
// and are revalidated by tag when the catalogue changes.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await cachedProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.short.fr,
    openGraph: { title: product.name, description: product.short.fr, images: [{ url: product.image }] },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await cachedProduct(slug);
  if (!product) notFound();
  const related = await cachedRelated(product.id, product.category);
  return <ProductDetail product={product} related={related} />;
}
