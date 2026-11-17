export type CategorySlug = "vision" | "power" | "interior" | "care";

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  image: string;
}

export interface VariantOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface Product {
  slug: string;
  name: string;
  category: CategorySlug;
  price: number;
  compareAt?: number;
  image: string;
  badge?: string;
  short: string;
  description: string;
  variantTitle: string;
  variants: VariantOption[];
  specs: [string, string][];
  inTheBox: string[];
  rating: number;
  reviews: number;
  bestSeller?: boolean;
  isNew?: boolean;
  featured?: boolean;
}

export const categories: Category[] = [
  {
    slug: "vision",
    name: "Vision & Lighting",
    tagline: "Cameras, recorders and LED upgrades",
    image: "/products/p2.jpg",
  },
  {
    slug: "power",
    name: "Power & Diagnostics",
    tagline: "Jump starters, inflators and scanners",
    image: "/products/p9.jpg",
  },
  {
    slug: "interior",
    name: "Interior & Storage",
    tagline: "Mounts, organizers and cabin comfort",
    image: "/products/p4.jpg",
  },
  {
    slug: "care",
    name: "Care & Cleaning",
    tagline: "Detailing tools that keep it showroom",
    image: "/products/p6.jpg",
  },
];

export const products: Product[] = [
  {
    slug: "reverseview-pro-kit",
    rating: 4.8,
    reviews: 214,
    name: "ReverseView Pro Camera Kit",
    category: "vision",
    price: 14900,
    compareAt: 18900,
    image: "/products/p1.jpg",
    bestSeller: true,
    short: "Backup camera with 4.3″ monitor and night-vision LEDs.",
    description:
      "Park with confidence. The ReverseView Pro pairs a wide-angle rear camera with four infrared LEDs for clear night vision, and a 4.3-inch dash monitor that draws parking guidelines in real time. Powered straight from the 12V socket — no workshop visit needed.",
    variantTitle: "Kit",
    variants: [
      { id: "standard", label: "Standard kit", priceDelta: 0 },
      { id: "extended", label: "With 6 m extension cable", priceDelta: 2000 },
    ],
    specs: [
      ["Monitor", "4.3″ LCD, 480 × 272"],
      ["Camera", "170° wide angle, IP68"],
      ["Night vision", "4 IR LEDs, up to 8 m"],
      ["Power", "12V socket, 5 W"],
      ["Guidelines", "Dynamic parking overlay"],
    ],
    inTheBox: ["4.3″ monitor with stand", "Rear camera + bracket", "12V power plug", "6 m video cable", "Mounting hardware"],
  },
  {
    slug: "roadeye-dual-dash-cam",
    rating: 4.7,
    reviews: 187,
    name: "RoadEye Dual Dash Cam",
    category: "vision",
    price: 19900,
    image: "/products/p2.jpg",
    bestSeller: true,
    short: "Windshield recorder with flip screen and IR night lens.",
    description:
      "A discreet witness for every drive. RoadEye records the road ahead through a blue-coated lens with infrared assist for low light, and its flip-out screen lets you frame the shot or review footage on the spot. Loop recording and impact locking keep the moments that matter.",
    variantTitle: "Configuration",
    variants: [
      { id: "front", label: "Front camera", priceDelta: 0 },
      { id: "dual", label: "Front + rear camera", priceDelta: 5500 },
    ],
    specs: [
      ["Resolution", "1080p @ 30 fps"],
      ["Lens", "140°, IR night assist"],
      ["Display", "2.7″ flip-out LCD"],
      ["Storage", "microSD up to 128 GB"],
      ["Recording", "Loop + G-sensor lock"],
    ],
    inTheBox: ["Dash cam unit", "Suction windshield mount", "12V power cable", "Rear camera (dual kit)", "Trim tool"],
  },
  {
    slug: "gripdash-phone-mount",
    rating: 4.5,
    reviews: 342,
    name: "GripDash Phone Mount",
    category: "interior",
    price: 3900,
    image: "/products/p3.jpg",
    short: "Weighted dash cradle with one-hand spring clips.",
    description:
      "Navigation at eye level, zero rattle. A weighted non-slip base keeps GripDash planted on the dash while spring-loaded side clips hold phones from 4.7″ to 7″. Drop the phone in with one hand; the padded jaws grip without blocking buttons.",
    variantTitle: "Finish",
    variants: [
      { id: "black", label: "Black / silver", priceDelta: 0 },
      { id: "carbon", label: "Carbon black", priceDelta: 500 },
    ],
    specs: [
      ["Fits phones", "4.7″ – 7.2″"],
      ["Base", "Weighted, anti-slip pad"],
      ["Grip", "Spring clips, padded jaws"],
      ["Rotation", "360° ball joint"],
      ["Mount", "Dashboard, no adhesive"],
    ],
    inTheBox: ["Phone cradle", "Weighted dash base", "Cable clip"],
  },
  {
    slug: "cargofold-trunk-organizer",
    rating: 4.6,
    reviews: 156,
    name: "CargoFold Trunk Organizer",
    category: "interior",
    price: 6900,
    image: "/products/p4.jpg",
    bestSeller: true,
    short: "Collapsible multi-compartment cargo box with tie-down.",
    description:
      "Groceries, tools, emergency kit — everything in its place. CargoFold's reinforced Oxford-cloth walls hold their shape loaded, then fold flat in seconds when you need the space. Mesh side pockets, a front flap pocket and a hook-and-strap tie-down keep cargo from sliding on the move.",
    variantTitle: "Layout",
    variants: [
      { id: "three", label: "3 compartments", priceDelta: 0 },
      { id: "five", label: "5 compartments", priceDelta: 1500 },
    ],
    specs: [
      ["Material", "600D Oxford cloth"],
      ["Open size", "60 × 35 × 30 cm"],
      ["Folded", "60 × 35 × 6 cm"],
      ["Pockets", "2 mesh sides + front flap"],
      ["Securing", "Tie-down strap + metal hook"],
    ],
    inTheBox: ["Organizer box", "Removable dividers", "Tie-down strap", "Carry handles"],
  },
  {
    slug: "tactical-seatback-panel",
    rating: 4.4,
    reviews: 98,
    name: "Tactical Seat-Back Panel",
    category: "interior",
    price: 7900,
    image: "/products/p5.jpg",
    short: "MOLLE seat-back storage with zip pouches and straps.",
    description:
      "Turn the back of your seat into a gear wall. The MOLLE webbing panel straps around any headrest and accepts pouches, tools and patches in any arrangement you like. Built from the same rugged fabric as outdoor packs, with reinforced stitching at every load point.",
    variantTitle: "Bundle",
    variants: [
      { id: "panel", label: "Panel only", priceDelta: 0 },
      { id: "bundle", label: "Panel + 3 utility pouches", priceDelta: 3000 },
    ],
    specs: [
      ["Material", "1000D nylon, MOLLE webbing"],
      ["Fits", "Any seat with headrest posts"],
      ["Pouches", "Zip + hook-and-loop compatible"],
      ["Straps", "Quick-release buckles"],
      ["Load", "Up to 8 kg distributed"],
    ],
    inTheBox: ["MOLLE panel", "Mounting straps", "3 utility pouches (bundle)", "Patch panel"],
  },
  {
    slug: "airvac-2in1-cordless",
    rating: 4.8,
    reviews: 263,
    name: "AirVac 2-in-1 Cordless Vacuum",
    category: "care",
    price: 9900,
    compareAt: 12900,
    image: "/products/p6.jpg",
    isNew: true,
    short: "Handheld vacuum and air duster with washable filter.",
    description:
      "Crumbs in the seats, dust in the vents — one tool for both. AirVac switches from suction to blowing with a twist, clearing vents and keyboards then collecting the debris. The transparent cup empties without mess and the filter rinses clean under a tap.",
    variantTitle: "Kit",
    variants: [
      { id: "standard", label: "Standard · 4 nozzles", priceDelta: 0 },
      { id: "pro", label: "Pro · 7 nozzles + brush kit", priceDelta: 2500 },
    ],
    specs: [
      ["Modes", "Vacuum + air duster"],
      ["Battery", "USB-C rechargeable, 30 min"],
      ["Cup", "Transparent, washable"],
      ["Filter", "Rinsable HEPA-style"],
      ["Weight", "540 g"],
    ],
    inTheBox: ["Vacuum / blower unit", "Crevice + brush nozzles", "USB-C cable", "Storage pouch (pro)"],
  },
  {
    slug: "snowfoam-cannon-lance",
    rating: 4.5,
    reviews: 129,
    name: "SnowFoam Cannon Lance",
    category: "care",
    price: 5900,
    image: "/products/p7.jpg",
    short: "Pressure-washer foam gun with adjustable mix.",
    description:
      "Thick, clinging snow foam that lifts road film before you touch the paint. The brass-bodied cannon meters shampoo and water to a dense foam, and the twist collar lets you dial from light rinse to shaving-cream thickness. Quick-connect fitting swaps onto most pressure washers in seconds.",
    variantTitle: "Bottle",
    variants: [
      { id: "1l", label: "1 L bottle", priceDelta: 0 },
      { id: "15l", label: "1.5 L bottle", priceDelta: 1200 },
    ],
    specs: [
      ["Fitting", "1/4″ quick-connect"],
      ["Body", "Brass + engineered polymer"],
      ["Adjustment", "Twist foam-density collar"],
      ["Max pressure", "160 bar / 2300 psi"],
      ["Bottle", "Translucent, graduated"],
    ],
    inTheBox: ["Foam cannon", "1 L bottle", "Quick-connect adapter", "Spare nozzle"],
  },
  {
    slug: "lumencore-led-pair",
    rating: 4.6,
    reviews: 152,
    name: "LumenCore LED Headlight Pair",
    category: "vision",
    price: 12900,
    image: "/products/p8.jpg",
    isNew: true,
    short: "COB LED conversion bulbs with finned heatsinks.",
    description:
      "A crisp, white upgrade over tired halogens. LumenCore's COB chips throw a focused beam pattern while the finned aluminium body pulls heat away for a long, stable life. Plug-and-play connectors mean a ten-minute swap in the driveway — no resistors, no coding.",
    variantTitle: "Fitment",
    variants: [
      { id: "h4", label: "H4 · hi/lo", priceDelta: 0 },
      { id: "h7", label: "H7 · low beam", priceDelta: 0 },
      { id: "h11", label: "H11 · fog / low", priceDelta: 0 },
    ],
    specs: [
      ["Chip", "COB LED, 6000 K white"],
      ["Output", "8,000 lm per pair"],
      ["Cooling", "Finned aluminium heatsink"],
      ["Life", "30,000 h rated"],
      ["Install", "Plug-and-play, CANbus-ready"],
    ],
    inTheBox: ["2 × LED bulbs", "Plug-and-play connectors", "Fitment guide"],
  },
  {
    slug: "jumpcore-1000-starter",
    rating: 4.9,
    reviews: 342,
    name: "JumpCore 1000 Jump Starter",
    category: "power",
    price: 16900,
    image: "/products/p9.jpg",
    bestSeller: true,
    featured: true,
    short: "Pocket jump starter with smart clamps and % display.",
    description:
      "A dead battery shouldn't end your day. JumpCore delivers up to 1000 A of starting current from a pack the size of a paperback, with smart clamps that protect against reverse polarity and sparks. The digital display shows exact charge, and it doubles as a power bank for your phone.",
    variantTitle: "Capacity",
    variants: [
      { id: "1000", label: "1000 A · up to 6.0 L", priceDelta: 0 },
      { id: "2000", label: "2000 A · up to 8.0 L", priceDelta: 5000 },
    ],
    specs: [
      ["Peak current", "1000 A"],
      ["Engines", "Petrol ≤ 6.0 L / diesel ≤ 3.0 L"],
      ["Display", "Digital charge %"],
      ["Safety", "Reverse-polarity + spark proof"],
      ["Extras", "USB power bank, LED torch"],
    ],
    inTheBox: ["Jump starter pack", "Smart jumper clamps", "USB-C cable", "Storage case"],
  },
  {
    slug: "precisionfill-inflator",
    rating: 4.7,
    reviews: 208,
    name: "PrecisionFill Tire Inflator",
    category: "power",
    price: 11900,
    image: "/products/p10.jpg",
    isNew: true,
    short: "Cordless digital pump with presets and auto-stop.",
    description:
      "Set the pressure, press start, walk away. PrecisionFill's digital gauge reads to 0.05 bar and stops automatically at your preset — car, bike, ball or custom mode. Cordless and compact enough for the glovebox, with adapters for everything from valves to air mattresses.",
    variantTitle: "Bundle",
    variants: [
      { id: "standard", label: "Standard", priceDelta: 0 },
      { id: "case", label: "With storage case", priceDelta: 1500 },
    ],
    specs: [
      ["Max pressure", "150 psi / 10.3 bar"],
      ["Gauge", "Digital, ±0.05 bar"],
      ["Modes", "Car / bike / ball / custom"],
      ["Auto-stop", "At preset pressure"],
      ["Battery", "USB-C, 4,000 mAh"],
    ],
    inTheBox: ["Inflator unit", "Screw-on hose", "Needle + valve adapters", "USB-C cable", "Drawstring pouch"],
  },
  {
    slug: "scanpro-v302-obd2",
    rating: 4.6,
    reviews: 74,
    name: "ScanPro V302 OBD2 Scanner",
    category: "power",
    price: 13900,
    image: "/products/p11.jpg",
    short: "Color-screen code reader with battery voltage test.",
    description:
      "Know what the check-engine light means before you pay anyone to tell you. The V302 reads and clears fault codes on all OBD-II cars, shows live sensor data on a color screen, and tests battery voltage with one press. Menus are plain-language — no mechanic required.",
    variantTitle: "Edition",
    variants: [
      { id: "v302", label: "V302 standard", priceDelta: 0 },
      { id: "v302plus", label: "V302+ · live data graphing", priceDelta: 3000 },
    ],
    specs: [
      ["Protocols", "All OBD-II / EOBD"],
      ["Functions", "DTC read/clear, live data"],
      ["Battery test", "Voltage + cranking check"],
      ["Display", "2.8″ color TFT"],
      ["Updates", "Free lifetime via USB"],
    ],
    inTheBox: ["V302 scanner", "16-pin OBD cable", "USB update cable", "Quick-start guide"],
  },
  {
    slug: "sportgrip-wheel-cover",
    rating: 4.3,
    reviews: 411,
    name: "SportGrip Steering Wheel Cover",
    category: "interior",
    price: 4900,
    image: "/products/p12.jpg",
    short: "Segmented grip cover in tan/black with sport stripes.",
    description:
      "A better hold, a warmer wheel, a sharper cabin. SportGrip's segmented panels put cushioned grip exactly where your hands sit, while the contrast stripes give the interior a purposeful, motorsport feel. Stretches on in minutes — no tools, no lacing.",
    variantTitle: "Size & color",
    variants: [
      { id: "m-tan", label: "M · 37–38 cm · Tan/Black", priceDelta: 0 },
      { id: "l-tan", label: "L · 39–40 cm · Tan/Black", priceDelta: 0 },
      { id: "m-black", label: "M · 37–38 cm · Black/Red", priceDelta: 400 },
    ],
    specs: [
      ["Material", "Microfiber leather + rubber core"],
      ["Grip", "Segmented cushioned panels"],
      ["Fit", "Stretch-on, universal"],
      ["Care", "Wipe clean"],
      ["Season", "Heat-resistant, cold-soft"],
    ],
    inTheBox: ["Steering wheel cover", "Fitment card"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export const categoryBySlug = Object.fromEntries(
  categories.map((c) => [c.slug, c]),
) as Record<CategorySlug, Category>;

export function productsInCategory(slug: CategorySlug): Product[] {
  return products.filter((p) => p.category === slug);
}

export function variantPrice(product: Product, variantId: string): number {
  const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0];
  return product.price + v.priceDelta;
}

export function variantLabel(product: Product, variantId: string): string {
  return (product.variants.find((x) => x.id === variantId) ?? product.variants[0]).label;
}

export const FREE_SHIPPING_THRESHOLD = 8000;
export const SHIPPING_FLAT = 600;
export const PROMO_CODE = "DRIVE10";
export const PROMO_RATE = 0.1;