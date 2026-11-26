"use client";

import { useState } from "react";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError, adminApi, errorMessage, invalidate, useApi } from "../lib/client";
import { ago, slugify } from "../lib/format";
import type { CategoryRow } from "../lib/types";
import { DataTable, type Column } from "../data/table";
import { Badge, Button, Card, EmptyState, Field, Input, Mono, PageHeader, Switch } from "../ui/core";
import { Drawer, Select, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

interface CatForm {
  slug: string;
  position: string;
  isActive: boolean;
  parentSlug: string;
  image: string;
  fr: { name: string; short: string; tagline: string };
  ar: { name: string; short: string; tagline: string };
}

const blank = (): CatForm => ({ slug: "", position: "0", isActive: true, parentSlug: "", image: "", fr: { name: "", short: "", tagline: "" }, ar: { name: "", short: "", tagline: "" } });

export function CategoriesPage() {
  const { can } = useSession();
  const writable = can("catalog:write");
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<{ items: CategoryRow[] }>("/admin/categories");
  const [editing, setEditing] = useState<{ original: string | null; form: CatForm } | null>(null);

  const remove = async (c: CategoryRow) => {
    if (!(await confirm({ title: `Supprimer « ${c.translations.fr?.name ?? c.slug} » ?`, description: "Seules les catégories vides peuvent être supprimées.", confirmLabel: "Supprimer", variant: "danger" }))) return;
    try {
      await adminApi(`/admin/categories/${c.slug}`, { method: "DELETE" });
      invalidate("/admin/categories");
      toast.success("Catégorie supprimée");
    } catch (err) {
      toast.error("Suppression impossible", errorMessage(err));
    }
  };
  const open = (c: CategoryRow) =>
    setEditing({
      original: c.slug,
      form: {
        slug: c.slug,
        position: String(c.position),
        isActive: c.isActive,
        parentSlug: c.parentSlug ?? "",
        image: c.image ?? "",
        fr: c.translations.fr ?? { name: "", short: "", tagline: "" },
        ar: c.translations.ar ?? { name: "", short: "", tagline: "" },
      },
    });

  const columns: Column<CategoryRow>[] = [
    {
      id: "name",
      header: "Catégorie",
      primary: true,
      cell: (c) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">{c.translations.fr?.name ?? c.slug}</span>
          <span className="block truncate text-xs text-ad-muted" dir="auto">
            {c.translations.ar?.name ?? "Pas de nom en arabe"}
          </span>
        </span>
      ),
    },
    { id: "slug", header: "Identifiant", cell: (c) => <Mono className="text-ad-muted">{c.slug}</Mono> },
    { id: "status", header: "Statut", mobile: true, width: "110px", cell: (c) => (c.isActive ? <Badge tone="green" dot>Visible</Badge> : <Badge dot>Masquée</Badge>) },
    { id: "products", header: "Produits", align: "end", mobile: true, width: "120px", cell: (c) => <span>{c.activeProductCount} <span className="text-ad-faint">/ {c.productCount}</span></span> },
    { id: "position", header: "Position", align: "end", width: "90px", cell: (c) => c.position },
    { id: "updated", header: "Modifiée", align: "end", width: "130px", cell: (c) => <span className="text-ad-muted">{ago(c.updatedAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Catégories"
        description="Le classement des produits sur la boutique. Les noms s’affichent en français et en arabe."
        actions={
          writable && (
            <Button variant="primary" onClick={() => setEditing({ original: null, form: blank() })}>
              <Plus size={15} /> Nouvelle catégorie
            </Button>
          )
        }
      />
      <Card padded={false}>
        <DataTable
          label="Catégories"
          rows={q.data?.items}
          rowId={(c) => c.id}
          columns={columns}
          loading={q.loading}
          error={q.error}
          onRetry={q.reload}
          onRowClick={writable ? open : undefined}
          rowActions={
            writable
              ? (c) => [
                  { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => open(c) },
                  { type: "separator" },
                  { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, disabled: c.productCount > 0, hint: c.productCount > 0 ? "Déplacez d’abord ses produits" : undefined, onSelect: () => void remove(c) },
                ]
              : undefined
          }
          empty={<EmptyState icon={<FolderTree size={18} />} title="Aucune catégorie" />}
        />
      </Card>
      {editing && <CategoryDrawer key={editing.original ?? "new"} initial={editing} all={q.data?.items ?? []} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategoryDrawer({ initial, all, onClose }: { initial: { original: string | null; form: CatForm }; all: CategoryRow[]; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(initial.form);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const isNew = !initial.original;
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.fr.name.trim()) e["translations.fr.name"] = "Obligatoire";
    if (!f.fr.short.trim()) e["translations.fr.short"] = "Obligatoire";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)) e.slug = "Minuscules, chiffres et tirets uniquement";
    const arUsed = f.ar.name.trim() || f.ar.short.trim();
    if (arUsed && !f.ar.name.trim()) e["translations.ar.name"] = "Obligatoire si un texte arabe est saisi";
    if (arUsed && !f.ar.short.trim()) e["translations.ar.short"] = "Obligatoire si un texte arabe est saisi";
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    const body = {
      slug: f.slug,
      position: Number(f.position) || 0,
      isActive: f.isActive,
      parentSlug: f.parentSlug || null,
      image: f.image.trim() || null,
      translations: { fr: { ...f.fr, name: f.fr.name.trim(), short: f.fr.short.trim() }, ...(arUsed ? { ar: { ...f.ar, name: f.ar.name.trim(), short: f.ar.short.trim() } } : {}) },
    };
    try {
      await adminApi(isNew ? "/admin/categories" : `/admin/categories/${initial.original}`, { method: isNew ? "POST" : "PUT", body });
      invalidate("/admin/categories", "/admin/products");
      toast.success(isNew ? "Catégorie créée" : "Catégorie enregistrée");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  const copy = (l: "fr" | "ar", k: "name" | "short" | "tagline", v: string) =>
    setF((x) => ({ ...x, [l]: { ...x[l], [k]: v }, ...(isNew && l === "fr" && k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {isNew ? "Créer la catégorie" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ad-faint">Français</h3>
          <Field label="Nom" htmlFor="c-fr-name" error={errors["translations.fr.name"]}>
            <Input id="c-fr-name" value={f.fr.name} maxLength={80} invalid={Boolean(errors["translations.fr.name"])} onChange={(e) => copy("fr", "name", e.target.value)} data-autofocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom court" htmlFor="c-fr-short" hint="Affiché sur les filtres" error={errors["translations.fr.short"]}>
              <Input id="c-fr-short" value={f.fr.short} maxLength={40} invalid={Boolean(errors["translations.fr.short"])} onChange={(e) => copy("fr", "short", e.target.value)} />
            </Field>
            <Field label="Accroche" optional htmlFor="c-fr-tag">
              <Input id="c-fr-tag" value={f.fr.tagline} maxLength={200} onChange={(e) => copy("fr", "tagline", e.target.value)} />
            </Field>
          </div>
        </section>
        <section className="space-y-3" dir="rtl" lang="ar">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ad-faint">Arabe</h3>
          <Field label="Nom (arabe)" htmlFor="c-ar-name" error={errors["translations.ar.name"]}>
            <Input id="c-ar-name" value={f.ar.name} maxLength={80} invalid={Boolean(errors["translations.ar.name"])} onChange={(e) => copy("ar", "name", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom court (arabe)" htmlFor="c-ar-short" error={errors["translations.ar.short"]}>
              <Input id="c-ar-short" value={f.ar.short} maxLength={40} invalid={Boolean(errors["translations.ar.short"])} onChange={(e) => copy("ar", "short", e.target.value)} />
            </Field>
            <Field label="Accroche (arabe)" htmlFor="c-ar-tag">
              <Input id="c-ar-tag" value={f.ar.tagline} maxLength={200} onChange={(e) => copy("ar", "tagline", e.target.value)} />
            </Field>
          </div>
        </section>
        <section className="space-y-3 border-t border-ad-border pt-5">
          <Field label="Identifiant d’URL" htmlFor="c-slug" error={errors.slug} hint={`/products?category=${f.slug || "…"}`}>
            <Input
              id="c-slug"
              value={f.slug}
              maxLength={120}
              invalid={Boolean(errors.slug)}
              onChange={(e) => {
                setSlugTouched(true);
                setF((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }));
              }}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Catégorie parente" htmlFor="c-parent" optional>
              <Select
                id="c-parent"
                value={f.parentSlug}
                onChange={(v) => setF((x) => ({ ...x, parentSlug: v }))}
                options={[{ value: "", label: "Aucune (niveau principal)", text: "Aucune" }, ...all.filter((c) => c.slug !== initial.original).map((c) => ({ value: c.slug, label: c.translations.fr?.name ?? c.slug }))]}
              />
            </Field>
            <Field label="Position" htmlFor="c-pos">
              <Input id="c-pos" inputMode="numeric" value={f.position} onChange={(e) => setF((x) => ({ ...x, position: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
            </Field>
          </div>
          <Field label="Chemin de l’image" optional htmlFor="c-img" hint="ex. /categories/vision.jpg">
            <Input id="c-img" value={f.image} maxLength={500} onChange={(e) => setF((x) => ({ ...x, image: e.target.value }))} />
          </Field>
          <Switch checked={f.isActive} onChange={(v) => setF((x) => ({ ...x, isActive: v }))} label="Visible sur la boutique" description="Une catégorie masquée garde ses produits mais disparaît de la navigation." />
        </section>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
