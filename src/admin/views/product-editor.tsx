"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes, ExternalLink, ImagePlus, MoreHorizontal, Plus, RotateCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, adminApi, errorMessage, frenchFields, invalidate, useApi } from "../lib/client";
import { fmtFull, num, slugify } from "../lib/format";
import { PRODUCT_STATUS } from "../lib/meta";
import type { CategoryRow, ProductDetail } from "../lib/types";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Mono, PageHeader, Skeleton, Switch, Textarea } from "../ui/core";
import { Menu, Select, Tabs, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";
import { StockDialog, type StockTarget } from "./stock-dialog";

type Locale = "fr" | "ar";
interface Copy {
  short: string;
  description: string;
  variantTitle: string;
  specs: [string, string][];
  inTheBox: string[];
}
interface VariantForm {
  key: string;
  id?: string;
  code: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: number;
  initialStock: string;
  isActive: boolean;
  labels: { fr: string; ar: string };
}
interface Form {
  name: string;
  slug: string;
  categorySlug: string;
  status: "draft" | "active" | "archived";
  isFeatured: boolean;
  isBestSeller: boolean;
  isNew: boolean;
  position: string;
  copy: Record<Locale, Copy>;
  variants: VariantForm[];
}

const emptyCopy = (): Copy => ({ short: "", description: "", variantTitle: "", specs: [], inTheBox: [] });
const newVariant = (n: number): VariantForm => ({ key: crypto.randomUUID(), code: n ? `option-${n + 1}` : "standard", sku: "", price: "", compareAtPrice: "", stock: 0, initialStock: "0", isActive: true, labels: { fr: n ? "" : "Standard", ar: n ? "" : "قياسي" } });

function fromProduct(p: ProductDetail, duplicate = false): Form {
  const copy = (l: Locale): Copy => ({
    short: p.short[l] ?? "",
    description: p.detail?.description[l] ?? "",
    variantTitle: p.variantTitle[l] ?? "",
    specs: (p.detail?.specs[l] ?? []).map(([k, v]) => [k, v] as [string, string]),
    inTheBox: [...(p.detail?.inTheBox[l] ?? [])],
  });
  return {
    name: duplicate ? `${p.name} (copy)` : p.name,
    slug: duplicate ? `${p.slug}-copy` : p.slug,
    categorySlug: p.category,
    status: duplicate ? "draft" : p.status,
    isFeatured: p.featured,
    isBestSeller: p.bestSeller,
    isNew: p.isNew,
    position: String(p.position),
    copy: { fr: copy("fr"), ar: copy("ar") },
    variants: p.adminVariants.map((v) => ({
      key: v.id,
      id: duplicate ? undefined : v.id,
      code: v.code,
      sku: duplicate ? `${v.sku}-COPY` : v.sku,
      price: String(v.price),
      compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "",
      stock: duplicate ? 0 : v.stock,
      initialStock: "0",
      isActive: v.isActive,
      labels: { fr: v.labels.fr, ar: v.labels.ar },
    })),
  };
}

const blank = (): Form => ({
  name: "",
  slug: "",
  categorySlug: "",
  status: "draft",
  isFeatured: false,
  isBestSeller: false,
  isNew: true,
  position: "0",
  copy: { fr: emptyCopy(), ar: emptyCopy() },
  variants: [newVariant(0)],
});

/** Client-side checks mirroring the API schema (the server validates again). */
function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Le nom est obligatoire";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)) e.slug = "Minuscules, chiffres et tirets uniquement";
  if (!f.categorySlug) e.categorySlug = "Choisissez une catégorie";
  if (!f.copy.fr.short.trim()) e["translations.fr.short"] = "La description courte est obligatoire";
  if (!f.copy.fr.description.trim()) e["translations.fr.description"] = "La description est obligatoire";
  const arUsed = f.copy.ar.short.trim() || f.copy.ar.description.trim();
  if (arUsed && !f.copy.ar.short.trim()) e["translations.ar.short"] = "Obligatoire si un texte arabe est saisi";
  if (arUsed && !f.copy.ar.description.trim()) e["translations.ar.description"] = "Obligatoire si un texte arabe est saisi";
  if (!f.variants.length) e.variants = "Ajoutez au moins une variante";
  const skus = new Set<string>();
  const codes = new Set<string>();
  f.variants.forEach((v, i) => {
    const sku = v.sku.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{1,63}$/.test(sku)) e[`variants.${i}.sku`] = "2 à 64 lettres, chiffres ou tirets";
    else if (skus.has(sku)) e[`variants.${i}.sku`] = "SKU en double";
    skus.add(sku);
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(v.code)) e[`variants.${i}.code`] = "Code en minuscules";
    else if (codes.has(v.code)) e[`variants.${i}.code`] = "Code en double";
    codes.add(v.code);
    if (v.price === "" || !Number.isInteger(Number(v.price))) e[`variants.${i}.price`] = "Prix en DA";
    if (v.compareAtPrice && Number(v.compareAtPrice) <= Number(v.price)) e[`variants.${i}.compareAtPrice`] = "Doit être supérieur au prix";
    if (!v.labels.fr.trim()) e[`variants.${i}.labels.fr`] = "Obligatoire";
    if (!v.labels.ar.trim()) e[`variants.${i}.labels.ar`] = "Obligatoire";
  });
  return e;
}

function toPayload(f: Form, isNew: boolean) {
  const copy = (c: Copy) => ({
    short: c.short.trim(),
    description: c.description.trim(),
    variantTitle: c.variantTitle.trim(),
    specs: c.specs.filter(([k, v]) => k.trim() && v.trim()).map(([k, v]) => [k.trim(), v.trim()]),
    inTheBox: c.inTheBox.map((x) => x.trim()).filter(Boolean),
  });
  const ar = f.copy.ar.short.trim() || f.copy.ar.description.trim() ? copy(f.copy.ar) : undefined;
  return {
    name: f.name.trim(),
    slug: f.slug,
    categorySlug: f.categorySlug,
    status: f.status,
    isFeatured: f.isFeatured,
    isBestSeller: f.isBestSeller,
    isNew: f.isNew,
    position: Number(f.position) || 0,
    translations: { fr: copy(f.copy.fr), ...(ar ? { ar } : {}) },
    variants: f.variants.map((v, i) => ({
      ...(v.id ? { id: v.id } : {}),
      code: v.code,
      sku: v.sku.trim().toUpperCase(),
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      ...(isNew || !v.id ? { stock: Number(v.initialStock) || 0 } : {}),
      isActive: v.isActive,
      position: i,
      labels: { fr: v.labels.fr.trim(), ar: v.labels.ar.trim() },
    })),
  };
}

export function ProductEditor({ id, duplicateOf }: { id?: string; duplicateOf?: string | null }) {
  const isNew = !id;
  const sourceId = id ?? duplicateOf ?? null;
  const key = sourceId ? `/admin/products/${sourceId}` : null;
  const q = useApi<{ product: ProductDetail }>(key);
  const cats = useApi<{ items: CategoryRow[] }>("/admin/categories");
  const { can } = useSession();
  const writable = can("catalog:write");
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<Form | null>(isNew && !duplicateOf ? blank() : null);
  const [baseline, setBaseline] = useState<string>(isNew && !duplicateOf ? JSON.stringify(blank()) : "");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<Locale>("fr");
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const product = q.data?.product;
  const dirty = form !== null && JSON.stringify(form) !== baseline;
  const seedFrom = useCallback(
    (p: ProductDetail) => {
      const f = fromProduct(p, Boolean(duplicateOf && isNew));
      setForm(f);
      setBaseline(JSON.stringify(f));
      setLoadedAt(p.updatedAt);
      setStale(false);
      setErrors({});
    },
    [duplicateOf, isNew],
  );
  // Seed from the server on first load. A newer server version replaces an
  // untouched form silently; with local edits it raises the conflict banner.
  useEffect(() => {
    if (!product) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed editable copy from server data
    if (!form) return seedFrom(product);
    if (isNew || !loadedAt || product.updatedAt === loadedAt) return;
    if (!dirty) seedFrom(product);
    else setStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = useCallback((p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f)), []);
  const patchCopy = (l: Locale, p: Partial<Copy>) => setForm((f) => (f ? { ...f, copy: { ...f.copy, [l]: { ...f.copy[l], ...p } } } : f));
  const patchVariant = (i: number, p: Partial<VariantForm>) => setForm((f) => (f ? { ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...p } : v)) } : f));

  const save = useCallback(async () => {
    if (!form || saving) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) {
      if (Object.keys(e).some((k) => k.startsWith("translations.ar"))) setLocale("ar");
      else if (Object.keys(e).some((k) => k.startsWith("translations.fr"))) setLocale("fr");
      toast.error("Vérifiez les champs en surbrillance");
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 30);
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const r = await adminApi<{ product: ProductDetail }>("/admin/products", { method: "POST", body: toPayload(form, true) });
        invalidate("/admin/products", "/admin/inventory", "/admin/categories");
        setBaseline(JSON.stringify(form));
        toast.success("Produit créé", "Ajoutez des images, puis publiez-le quand il est prêt.");
        router.replace(`/admin/products/${r.product.id}`);
      } else {
        const r = await adminApi<{ product: ProductDetail }>(`/admin/products/${id}`, { method: "PATCH", body: { ...toPayload(form, false), expectedUpdatedAt: loadedAt } });
        const f = fromProduct(r.product);
        setForm(f);
        setBaseline(JSON.stringify(f));
        setLoadedAt(r.product.updatedAt);
        invalidate("/admin/products", "/admin/inventory", "/admin/categories");
        toast.success("Modifications enregistrées");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT" && err.reason === "stale") {
        setStale(true);
        toast.error("Quelqu’un d’autre a modifié ce produit", "Rechargez pour voir ses modifications. Les vôtres sont conservées jusqu’au rechargement.");
      } else if (err instanceof ApiError && err.fields) {
        setErrors(frenchFields(err.fields));
        toast.error("Enregistrement impossible", errorMessage(err));
      } else toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [form, saving, isNew, id, loadedAt, router, toast]);

  // Ctrl/⌘+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (writable) void save();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save, writable]);

  const categoryOptions = useMemo(() => (cats.data?.items ?? []).map((c) => ({ value: c.slug, label: c.translations.fr?.name ?? c.slug, hint: c.isActive ? undefined : "Inactive" })), [cats.data]);

  if (q.error && !product) {
    return (
      <>
        <PageHeader title="Produit" back={{ href: "/admin/products", label: "Produits" }} />
        <Card>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Card>
      </>
    );
  }
  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const c = form.copy[locale];
  const rtl = locale === "ar";

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageHeader
        back={{ href: "/admin/products", label: "Produits" }}
        title={isNew ? (duplicateOf ? "Dupliquer le produit" : "Nouveau produit") : form.name || "Sans titre"}
        meta={!isNew && product && <Badge tone={PRODUCT_STATUS[product.status].tone} dot>{PRODUCT_STATUS[product.status].label}</Badge>}
        description={!isNew && product ? `Dernière modification le ${fmtFull(product.updatedAt)}` : "Renseignez l’essentiel ; vous pourrez ajouter des images après l’enregistrement."}
        actions={
          <>
            {!isNew && product && (
              <Menu
                label="Plus"
                items={[
                  { label: "Voir sur la boutique", icon: <ExternalLink size={14} />, disabled: product.status !== "active", onSelect: () => window.open(`/products/${product.slug}`, "_blank", "noopener") },
                  ...(writable ? [{ label: "Duplicate", onSelect: () => router.push(`/admin/products/new?from=${product.id}`) }] : []),
                  ...(writable && product.status !== "archived"
                    ? [
                        { type: "separator" as const },
                        {
                          label: "Archiver le produit",
                          danger: true,
                          onSelect: async () => {
                            if (!(await confirm({ title: "Archiver ce produit ?", description: "Il disparaît de la boutique ; l’historique des commandes est conservé.", confirmLabel: "Archiver", variant: "danger" }))) return;
                            try {
                              await adminApi(`/admin/products/${product.id}`, { method: "DELETE" });
                              invalidate("/admin/products");
                              toast.success("Produit archivé");
                              setStale(true);
                              void q.reload();
                            } catch (e) {
                              toast.error("Archivage impossible", errorMessage(e));
                            }
                          },
                        },
                      ]
                    : []),
                ]}
                trigger={(p) => (
                  <Button {...p} icon aria-label="Plus d’actions">
                    <MoreHorizontal size={16} />
                  </Button>
                )}
              />
            )}
            {writable && (
              <>
                {dirty && !isNew && (
                  <Button
                    onClick={() => {
                      setForm(JSON.parse(baseline));
                      setErrors({});
                    }}
                  >
                    Abandonner
                  </Button>
                )}
                <Button type="submit" variant="primary" loading={saving} disabled={!dirty && !isNew}>
                  {isNew ? "Créer le produit" : "Enregistrer les modifications"}
                </Button>
              </>
            )}
          </>
        }
      />

      {stale && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ad-amber/30 bg-ad-amber-soft px-4 py-3 text-[13px] text-ad-amber">
          <span>Ce produit a été modifié par quelqu’un d’autre depuis son ouverture. Enregistrer écraserait ses modifications.</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const latest = await adminApi<{ product: ProductDetail }>(key!);
                seedFrom(latest.product);
                invalidate(key!);
              } catch (e) {
                toast.error("Rechargement impossible", errorMessage(e));
              }
            }}
          >
            <RotateCw size={13} /> Recharger la dernière version
          </Button>
        </div>
      )}

      <fieldset disabled={!writable} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Informations" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" htmlFor="p-name" error={err("name")} className="sm:col-span-2">
                <Input
                  id="p-name"
                  value={form.name}
                  invalid={Boolean(err("name"))}
                  maxLength={120}
                  onChange={(e) => patch({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
                  placeholder="ex. RoadEye Dual Dash Cam"
                />
              </Field>
              <Field label="Identifiant d’URL" htmlFor="p-slug" error={err("slug")} hint={`/products/${form.slug || "…"}`} className="sm:col-span-2">
                <Input
                  id="p-slug"
                  value={form.slug}
                  invalid={Boolean(err("slug"))}
                  maxLength={120}
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-5">
              <h2 className="text-sm font-semibold">Contenu</h2>
              <Tabs
                value={locale}
                onChange={setLocale}
                className="border-b-0"
                tabs={[
                  { value: "fr", label: <span>Français{(err("translations.fr.short") || err("translations.fr.description")) && <span className="ms-1 text-ad-red">•</span>}</span> },
                  { value: "ar", label: <span>Arabe{(err("translations.ar.short") || err("translations.ar.description")) && <span className="ms-1 text-ad-red">•</span>}</span> },
                ]}
              />
            </div>
            <div className="space-y-4 border-t border-ad-border p-4 sm:p-5" dir={rtl ? "rtl" : "ltr"} lang={locale}>
              {rtl && <p className="text-xs text-ad-faint" dir="ltr">Facultatif. Sans texte arabe, la boutique affiche le texte français.</p>}
              <Field label={rtl ? "Description courte (arabe)" : "Description courte"} htmlFor={`p-short-${locale}`} error={err(`translations.${locale}.short`)}>
                <Textarea id={`p-short-${locale}`} rows={2} maxLength={300} value={c.short} invalid={Boolean(err(`translations.${locale}.short`))} onChange={(e) => patchCopy(locale, { short: e.target.value })} />
              </Field>
              <Field label={rtl ? "Description (arabe)" : "Description"} htmlFor={`p-desc-${locale}`} error={err(`translations.${locale}.description`)}>
                <Textarea id={`p-desc-${locale}`} rows={6} maxLength={5000} value={c.description} invalid={Boolean(err(`translations.${locale}.description`))} onChange={(e) => patchCopy(locale, { description: e.target.value })} />
              </Field>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium">{rtl ? "Caractéristiques (arabe)" : "Caractéristiques"}</span>
                  <Button size="xs" variant="ghost" onClick={() => patchCopy(locale, { specs: [...c.specs, ["", ""]] })} disabled={c.specs.length >= 30}>
                    <Plus size={13} /> Ajouter
                  </Button>
                </div>
                {c.specs.length === 0 && <p className="text-xs text-ad-faint">{"Aucune caractéristique pour le moment."}</p>}
                <div className="space-y-2">
                  {c.specs.map(([k, v], i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label={`Caractéristique ${i + 1} : nom`} value={k} maxLength={80} placeholder={rtl ? "الخاصية" : "Propriété"} className="w-2/5" onChange={(e) => patchCopy(locale, { specs: c.specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)) })} />
                      <Input aria-label={`Caractéristique ${i + 1} : valeur`} value={v} maxLength={200} placeholder={rtl ? "القيمة" : "Valeur"} className="flex-1" onChange={(e) => patchCopy(locale, { specs: c.specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)) })} />
                      <Button variant="ghost" icon aria-label={`Retirer la caractéristique ${i + 1}`} onClick={() => patchCopy(locale, { specs: c.specs.filter((_, j) => j !== i) })}>
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium">{rtl ? "Contenu de la boîte (arabe)" : "Contenu de la boîte"}</span>
                  <Button size="xs" variant="ghost" onClick={() => patchCopy(locale, { inTheBox: [...c.inTheBox, ""] })} disabled={c.inTheBox.length >= 30}>
                    <Plus size={13} /> Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {c.inTheBox.map((x, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label={`Élément ${i + 1} de la boîte`} value={x} maxLength={200} className="flex-1" onChange={(e) => patchCopy(locale, { inTheBox: c.inTheBox.map((y, j) => (j === i ? e.target.value : y)) })} />
                      <Button variant="ghost" icon aria-label={`Retirer l’élément ${i + 1}`} onClick={() => patchCopy(locale, { inTheBox: c.inTheBox.filter((_, j) => j !== i) })}>
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card padded={false}>
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold">Variantes</h2>
                <p className="mt-0.5 text-[13px] text-ad-muted">Les options proposées aux clients, chacune avec son SKU, son prix et son stock.</p>
              </div>
              <div className="flex gap-2">
                <Input aria-label="Intitulé de l’option (français)" value={form.copy.fr.variantTitle} onChange={(e) => patchCopy("fr", { variantTitle: e.target.value })} placeholder="Intitulé de l’option, ex. Format" inputSize="sm" className="w-44" maxLength={60} />
              </div>
            </div>
            {err("variants") && <p className="px-5 pt-2 text-xs text-ad-red">{err("variants")}</p>}
            <div className="mt-3 divide-y divide-ad-border border-t border-ad-border">
              {form.variants.map((v, i) => (
                <div key={v.key} className={cn("grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-12", !v.isActive && "bg-ad-subtle/60")}>
                  <Field label="Libellé (FR)" error={err(`variants.${i}.labels.fr`)} className="md:col-span-3" htmlFor={`v-${i}-fr`}>
                    <Input id={`v-${i}-fr`} inputSize="sm" value={v.labels.fr} invalid={Boolean(err(`variants.${i}.labels.fr`))} maxLength={120} onChange={(e) => patchVariant(i, { labels: { ...v.labels, fr: e.target.value } })} />
                  </Field>
                  <Field label="Libellé (AR)" error={err(`variants.${i}.labels.ar`)} className="md:col-span-3" htmlFor={`v-${i}-ar`}>
                    <Input id={`v-${i}-ar`} inputSize="sm" dir="rtl" value={v.labels.ar} invalid={Boolean(err(`variants.${i}.labels.ar`))} maxLength={120} onChange={(e) => patchVariant(i, { labels: { ...v.labels, ar: e.target.value } })} />
                  </Field>
                  <Field label="SKU" error={err(`variants.${i}.sku`)} className="md:col-span-3" htmlFor={`v-${i}-sku`}>
                    <Input id={`v-${i}-sku`} inputSize="sm" className="font-[family-name:var(--font-admin-mono)] uppercase" value={v.sku} invalid={Boolean(err(`variants.${i}.sku`))} maxLength={64} onChange={(e) => patchVariant(i, { sku: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Code" error={err(`variants.${i}.code`)} className="md:col-span-3" htmlFor={`v-${i}-code`}>
                    <Input id={`v-${i}-code`} inputSize="sm" value={v.code} invalid={Boolean(err(`variants.${i}.code`))} maxLength={40} onChange={(e) => patchVariant(i, { code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                  </Field>
                  <Field label="Prix" error={err(`variants.${i}.price`)} className="md:col-span-3" htmlFor={`v-${i}-price`}>
                    <Input id={`v-${i}-price`} inputSize="sm" inputMode="numeric" suffix="DA" value={v.price} invalid={Boolean(err(`variants.${i}.price`))} onChange={(e) => patchVariant(i, { price: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
                  </Field>
                  <Field label="Prix barré" optional error={err(`variants.${i}.compareAtPrice`)} className="md:col-span-3" htmlFor={`v-${i}-cmp`}>
                    <Input id={`v-${i}-cmp`} inputSize="sm" inputMode="numeric" suffix="DA" value={v.compareAtPrice} invalid={Boolean(err(`variants.${i}.compareAtPrice`))} onChange={(e) => patchVariant(i, { compareAtPrice: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
                  </Field>
                  <Field label={v.id ? "Stock" : "Stock initial"} className="md:col-span-3" htmlFor={`v-${i}-stock`}>
                    {v.id ? (
                      <div className="flex h-8 items-center justify-between gap-2 rounded-md border border-ad-border bg-ad-subtle px-2.5 text-[13px]">
                        <span className={cn("tnum", v.stock === 0 && "text-ad-red")}>{num(v.stock)}</span>
                        {can("inventory:write") && (
                          <button type="button" className="cursor-pointer text-xs text-ad-muted underline-offset-2 hover:text-ad-fg hover:underline" onClick={() => setStockTarget({ variantId: v.id!, sku: v.sku, label: v.labels.fr, stock: v.stock })}>
                            Ajuster
                          </button>
                        )}
                      </div>
                    ) : (
                      <Input id={`v-${i}-stock`} inputSize="sm" inputMode="numeric" value={v.initialStock} onChange={(e) => patchVariant(i, { initialStock: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
                    )}
                  </Field>
                  <div className="flex items-end justify-between gap-2 md:col-span-3">
                    <div className="flex h-8 items-center">
                      <Switch checked={v.isActive} onChange={(on) => patchVariant(i, { isActive: on })} label="Active" />
                    </div>
                    <div className="flex">
                      <Button variant="ghost" size="sm" icon aria-label="Monter la variante" disabled={i === 0} onClick={() => patch({ variants: move(form.variants, i, i - 1) })}>
                        <ArrowLeft size={14} className="rotate-90" />
                      </Button>
                      <Button variant="ghost" size="sm" icon aria-label="Descendre la variante" disabled={i === form.variants.length - 1} onClick={() => patch({ variants: move(form.variants, i, i + 1) })}>
                        <ArrowRight size={14} className="rotate-90" />
                      </Button>
                      {!v.id && (
                        <Button variant="ghost" size="sm" icon aria-label="Retirer la variante" onClick={() => patch({ variants: form.variants.filter((_, j) => j !== i) })}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-ad-border px-4 py-3 sm:px-5">
              <Button size="sm" onClick={() => patch({ variants: [...form.variants, newVariant(form.variants.length)] })} disabled={form.variants.length >= 50}>
                <Plus size={14} /> Ajouter une variante
              </Button>
              <span className="ms-3 text-xs text-ad-faint">Une variante enregistrée peut être désactivée mais pas supprimée, pour préserver l’historique des commandes.</span>
            </div>
          </Card>

          {!isNew && product && <Images product={product} writable={can("media:write")} onChanged={() => invalidate(`/admin/products/${product.id}`, "/admin/products")} />}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Statut" />
            <Select
              ariaLabel="Statut du produit"
              value={form.status}
              onChange={(v) => patch({ status: v })}
              options={[
                { value: "active", label: "Actif", hint: "Visible sur la boutique" },
                { value: "draft", label: "Brouillon", hint: "Masqué" },
                { value: "archived", label: "Archivé", hint: "Masqué" },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Organisation" />
            <div className="space-y-4">
              <Field label="Catégorie" htmlFor="p-category" error={err("categorySlug")}>
                <Select id="p-category" value={form.categorySlug} onChange={(v) => patch({ categorySlug: v })} options={categoryOptions} placeholder="Choisir une catégorie" invalid={Boolean(err("categorySlug"))} />
              </Field>
              <Field label="Position de tri" htmlFor="p-position" hint="Les plus petits nombres apparaissent en premier dans « Mis en avant ».">
                <Input id="p-position" inputMode="numeric" value={form.position} onChange={(e) => patch({ position: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Mise en avant" />
            <div className="space-y-4">
              <Switch checked={form.isFeatured} onChange={(v) => patch({ isFeatured: v })} label="Mis en avant" description="Affiché en premier dans les listes" />
              <Switch checked={form.isBestSeller} onChange={(v) => patch({ isBestSeller: v })} label="Top vente" description="Rubrique de la page d’accueil et badge" />
              <Switch checked={form.isNew} onChange={(v) => patch({ isNew: v })} label="Nouveauté" description="Rubrique de la page d’accueil et badge" />
            </div>
          </Card>
          {!isNew && product && (
            <Card>
              <CardHeader title="Performances" />
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-ad-muted">Note</dt>
                  <dd className="tnum mt-0.5 font-medium">{product.reviews ? `${product.rating.toFixed(1)} / 5` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-ad-muted">Avis</dt>
                  <dd className="tnum mt-0.5 font-medium">{product.reviews}</dd>
                </div>
                <div>
                  <dt className="text-ad-muted">Unités en stock</dt>
                  <dd className="tnum mt-0.5 font-medium">{num(product.adminVariants.reduce((s, v) => s + (v.isActive ? v.stock : 0), 0))}</dd>
                </div>
                <div>
                  <dt className="text-ad-muted">Créé le</dt>
                  <dd className="mt-0.5 font-medium">{new Date(product.createdAt).toLocaleDateString("fr-FR")}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.push(`/admin/inventory?search=${encodeURIComponent(product.slug.split("-")[0])}`)}>
                  <Boxes size={13} /> Stock
                </Button>
                {can("reviews:moderate") && (
                  <Button size="sm" onClick={() => router.push(`/admin/reviews?product=${product.id}`)}>
                    Avis
                  </Button>
                )}
              </div>
            </Card>
          )}
          {writable && <p className="px-1 text-xs text-ad-faint">Astuce : Ctrl+S pour enregistrer.</p>}
        </div>
      </fieldset>
      <StockDialog
        target={stockTarget}
        onClose={() => setStockTarget(null)}
        onDone={(stock) => {
          if (!stockTarget) return;
          // reflect the new on-hand quantity without discarding other edits
          const upd = (f: Form) => ({ ...f, variants: f.variants.map((v) => (v.id === stockTarget.variantId ? { ...v, stock } : v)) });
          setForm((f) => (f ? upd(f) : f));
          setBaseline((b) => (b ? JSON.stringify(upd(JSON.parse(b))) : b));
        }}
      />
    </form>
  );
}

function move<T>(xs: T[], from: number, to: number) {
  const out = [...xs];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

function Images({ product, writable, onChanged }: { product: ProductDetail; writable: boolean; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const images = product.adminImages;

  const upload = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Choisissez des images JPEG, PNG ou WebP");
    for (const f of list) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 10 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.set("file", f);
        form.set("alt", product.name);
        await adminApi(`/admin/products/${product.id}/images`, { method: "POST", form });
        onChanged();
      } catch (err) {
        toast.error(`Échec de l’envoi de ${f.name}`, errorMessage(err));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const reorder = async (from: number, to: number) => {
    const ids = move(images.map((i) => i.id), from, to);
    try {
      await adminApi(`/admin/products/${product.id}/images`, { method: "PUT", body: { order: ids } });
      onChanged();
    } catch (err) {
      toast.error("Réorganisation impossible", errorMessage(err));
    }
  };
  const remove = async (imageId: string) => {
    if (!(await confirm({ title: "Supprimer cette image ?", description: "Le fichier est supprimé du stockage. Cette action est irréversible.", confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await adminApi(`/admin/products/${product.id}/images/${imageId}`, { method: "DELETE" });
      onChanged();
      toast.success("Image supprimée");
    } catch (err) {
      toast.error("Suppression impossible", errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Images" description="La première image sert de couverture. Les fichiers envoyés sont convertis en WebP optimisé." />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="group relative overflow-hidden rounded-lg border border-ad-border bg-ad-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of stored renditions */}
            <img src={img.variants?.md ?? img.url} alt={img.alt ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
            {i === 0 && <span className="absolute start-2 top-2 rounded bg-ad-panel/95 px-1.5 py-0.5 text-[11px] font-medium shadow-ad">Couverture</span>}
            {writable && (
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <div className="flex gap-1">
                  <Button size="xs" icon aria-label="Avancer l’image" disabled={i === 0} onClick={() => reorder(i, i - 1)}>
                    <ArrowLeft size={13} />
                  </Button>
                  <Button size="xs" icon aria-label="Reculer l’image" disabled={i === images.length - 1} onClick={() => reorder(i, i + 1)}>
                    <ArrowRight size={13} />
                  </Button>
                </div>
                <Button size="xs" icon aria-label="Supprimer l’image" onClick={() => remove(img.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            )}
          </li>
        ))}
        {writable && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void upload(e.dataTransfer.files);
              }}
              className={cn(
                "flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-[13px] text-ad-muted transition-colors hover:border-ad-border-strong hover:text-ad-fg",
                drag ? "border-ad-fg bg-ad-hover" : "border-ad-border-strong",
              )}
            >
              <ImagePlus size={20} />
              {uploading ? `Envoi de ${uploading}…` : "Ajouter des images"}
              <span className="text-[11px] text-ad-faint">or drop files · max 10 MB</span>
            </button>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden aria-label="Envoyer des images" onChange={(e) => e.target.files && void upload(e.target.files).then(() => (e.target.value = ""))} />
          </li>
        )}
      </ul>
      {!writable && images.length === 0 && <p className="text-[13px] text-ad-muted">Aucune image.</p>}
      {images.length > 0 && <Mono className="mt-3 block text-xs text-ad-faint">{images.length} image{images.length === 1 ? "" : "s"}</Mono>}
    </Card>
  );
}
