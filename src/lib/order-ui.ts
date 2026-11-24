import type { OrderStage, TrackingStep } from "./api-types";

/** Message key (order.trkDetail.*) describing each tracking step. */
export function stepDetailKey(step: TrackingStep, done: boolean, carrier?: string | null): string {
  switch (step) {
    case "placed":
      return "paymentConfirmed";
    case "packed":
      return "warehouse";
    case "shipped":
      return carrier ? "carrier" : "carrierPending";
    case "out":
      return "withCourier";
    case "delivered":
      return done ? "leftRecipient" : "signature";
  }
}

export const isClosed = (stage: OrderStage) => stage === "delivered" || stage === "cancelled";
