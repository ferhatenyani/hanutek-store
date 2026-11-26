import type { OrderStatus } from "@/lib/api-types";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "En attente", tone: "amber", hint: "Passée, en attente de confirmation" },
  confirmed: { label: "Confirmée", tone: "blue", hint: "Confirmée avec le client" },
  packed: { label: "Préparée", tone: "violet", hint: "Prête à remettre au transporteur" },
  shipped: { label: "Expédiée", tone: "blue", hint: "Chez le transporteur" },
  out_for_delivery: { label: "En livraison", tone: "blue", hint: "En route vers le client" },
  delivered: { label: "Livrée", tone: "green", hint: "Livrée, paiement encaissé" },
  cancelled: { label: "Annulée", tone: "neutral", hint: "Annulée ; stock réintégré" },
  returned: { label: "Retournée", tone: "red", hint: "Retournée ; stock réintégré" },
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

/** Verb used on the action button that moves an order INTO this status. */
export const TRANSITION_VERB: Record<OrderStatus, string> = {
  pending: "Rouvrir",
  confirmed: "Confirmer",
  packed: "Marquer préparée",
  shipped: "Expédier",
  out_for_delivery: "Mettre en livraison",
  delivered: "Marquer livrée",
  cancelled: "Annuler la commande",
  returned: "Marquer retournée",
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Non payée", tone: "neutral" },
  paid: { label: "Payée", tone: "green" },
  refunded: { label: "Remboursée", tone: "red" },
};

export const PRODUCT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Actif", tone: "green" },
  draft: { label: "Brouillon", tone: "neutral" },
  archived: { label: "Archivé", tone: "amber" },
};

export const ROLE: Record<string, { label: string; tone: Tone }> = {
  customer: { label: "Client", tone: "neutral" },
  staff: { label: "Équipe", tone: "blue" },
  admin: { label: "Administrateur", tone: "violet" },
};

export const MOVEMENT_REASON: Record<string, { label: string; tone: Tone }> = {
  order: { label: "Commande", tone: "neutral" },
  cancel: { label: "Annulation", tone: "amber" },
  return: { label: "Retour", tone: "red" },
  adjustment: { label: "Ajustement", tone: "blue" },
  restock: { label: "Réassort", tone: "green" },
};

export const PERMISSION_LABEL: Record<string, string> = {
  "catalog:read": "Consulter le catalogue",
  "catalog:write": "Modifier produits et catégories",
  "inventory:write": "Ajuster le stock",
  "orders:read": "Consulter commandes et statistiques",
  "orders:write": "Traiter les commandes",
  "customers:read": "Consulter les clients",
  "customers:write": "Désactiver des clients, fermer leurs sessions",
  "promotions:write": "Gérer les codes promo",
  "reviews:moderate": "Modérer les avis",
  "media:write": "Téléverser des images produits",
  "audit:read": "Consulter le journal d’audit",
  "users:manage_roles": "Modifier les rôles",
  "settings:manage": "Transporteurs et outils système",
};

const ACTION_LABEL: Record<string, string> = {
  "order.status": "Statut de commande modifié",
  "order.update": "Commande modifiée",
  "order.bulk_status": "Statuts de commandes modifiés en masse",
  "product.create": "Produit créé",
  "product.update": "Produit modifié",
  "product.archive": "Produit archivé",
  "product.bulk_update": "Produits modifiés en masse",
  "product.image.add": "Image produit ajoutée",
  "product.image.remove": "Image produit supprimée",
  "product.image.reorder": "Images produit réordonnées",
  "category.create": "Catégorie créée",
  "category.update": "Catégorie modifiée",
  "category.delete": "Catégorie supprimée",
  "inventory.adjust": "Stock ajusté",
  "inventory.bulk_adjust": "Stock ajusté en masse",
  "promotion.create": "Code promo créé",
  "promotion.update": "Code promo modifié",
  "promotion.delete": "Code promo supprimé",
  "review.moderate": "Avis modéré",
  "review.bulk_moderate": "Avis modérés en masse",
  "customer.update": "Client modifié",
  "customer.sessions_revoked": "Sessions du client fermées",
  "customer.revoke_sessions": "Sessions du client fermées",
  "ops.clear_rate_limits": "Compteurs de limitation effacés",
  "ops.purge_guest_carts": "Paniers invités purgés",
  "user.role": "Rôle modifié",
  "carrier.create": "Transporteur ajouté",
  "carrier.update": "Transporteur modifié",
  "carrier.delete": "Transporteur supprimé",
  "system.purge_carts": "Paniers abandonnés purgés",
  "newsletter.export": "Abonnés exportés",
};

/** "product.bulk_update" → "Produits modifiés en masse" (falls back to a readable form of the key) */
export function actionLabel(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const s = action.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
