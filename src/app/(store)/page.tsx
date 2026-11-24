import { cachedHomeRails } from "@/server/queries";
import { HomeView } from "./home-view";

// Static shell, regenerated in the background (and on catalogue changes via tag revalidation).
export const revalidate = 300;

export default async function HomePage() {
  const { bestSellers, newArrivals } = await cachedHomeRails();
  return <HomeView bestSellers={bestSellers} newArrivals={newArrivals} />;
}
