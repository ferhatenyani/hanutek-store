import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Space_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141814" },
  ],
};

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "600", "700"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "hanutek — Équipement auto pour l'Algérie",
    template: "%s · hanutek",
  },
  description:
    "Dash cams, boosters, organisateurs et plus. Du matériel auto testé sur route, livré partout en Algérie.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      dir="ltr"
      data-scroll-behavior="smooth"
      // the inline script below may add data-lite before hydration
      suppressHydrationWarning
      className={`${inter.variable} ${grotesk.variable} ${spaceMono.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full">
        {/*
          Runs during parsing, so its listeners are registered before the
          router's.
          - Push direction: stamps --vt-old/--vt-new on <html> for link
            clicks and Back/Forward BEFORE the old snapshot is taken;
            globals.css animates the root pair from these properties.
          - Back/Forward view transitions: React flushes a transition started
            DURING a popstate event eagerly with SyncLane mixed in (so the
            browser can restore scroll synchronously), and a lane set with
            SyncLane is never view-transition eligible — pops would swap
            with no product-image morph. The native popstate is stopped here
            and replayed as a new PopStateEvent in the next task: Next's
            router handles it identically, React sees an ordinary transition
            and runs the view transition. Scroll is restored inside that
            transition by NavigationTracker (components/product-morph.tsx).
            Same-pathname pops and reduced motion keep the native path.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
var N=navigator,lite=(N.deviceMemory>0&&N.deviceMemory<=2)||(N.hardwareConcurrency>0&&N.hardwareConcurrency<=2);
if(lite){document.documentElement.setAttribute("data-lite","");try{Object.defineProperty(document,"startViewTransition",{value:undefined,configurable:true})}catch(x){}}
if(!lite&&!("startViewTransition" in document))return;
var T=["/","/products","/favorites","/profile"];
function ix(p){p=(p||"").split(/[?#]/)[0];if(p==="/")return 0;for(var i=1;i<4;i++){if(p===T[i]||p.indexOf(T[i]+"/")===0)return i}return 4}
function dir(f,t){var a=ix(f),b=ix(t);if(a!==b)return b>a?"nav-forward":"nav-back";return t.split("/").length>=f.split("/").length?"nav-forward":"nav-back"}
function stamp(d){
var e=document.documentElement,rtl=e.dir==="rtl";
e.dataset.nav=d;
e.style.setProperty("--vt-old",d==="nav-forward"?(rtl?"vt-out-back":"vt-out-fwd"):(rtl?"vt-out-fwd":"vt-out-back"));
e.style.setProperty("--vt-new",d==="nav-forward"?(rtl?"vt-in-back":"vt-in-fwd"):(rtl?"vt-in-fwd":"vt-in-back"));
window.__vtStampId=(window.__vtStampId||0)+1;clearTimeout(window.__vtStampT);
window.__vtStampT=setTimeout(function(){e.style.removeProperty("--vt-old");e.style.removeProperty("--vt-new");delete e.dataset.nav},10000);
}
var last=location.pathname;
var ps=history.pushState.bind(history),rs=history.replaceState.bind(history);
history.pushState=function(){var r=ps.apply(history,arguments);last=location.pathname;return r};
history.replaceState=function(){var r=rs.apply(history,arguments);last=location.pathname;return r};
document.addEventListener("click",function(e){
var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
if(!a||a.target||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
var u;try{u=new URL(a.href,location.href)}catch(x){return}
if(u.origin!==location.origin||u.pathname===location.pathname)return;
stamp(dir(location.pathname,u.pathname));
},true);
window.addEventListener("popstate",function(e){
if(e.__replay)return;
var to=location.pathname,from=last;last=to;
if(from===to)return;
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
stamp(dir(from,to));
if(lite)return;
e.stopImmediatePropagation();
var st=e.state;
setTimeout(function(){var r=new PopStateEvent("popstate",{state:st});r.__replay=1;window.dispatchEvent(r)},0);
});
})();`,
          }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
