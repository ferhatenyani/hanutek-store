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
      className={`${inter.variable} ${grotesk.variable} ${spaceMono.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full">
        {/*
          A2 hardware Back/Forward — direction-aware push.
          Next 16 starts a view transition ONLY for typed navigations, and
          handles `popstate` synchronously before any React-side listener
          could react. This inline script executes during parsing (before
          the deferred router chunk registers its popstate listener), so it
          wins the race: it stamps <html data-nav> and starts a manual
          startViewTransition whose OLD snapshot is captured before the
          router mutates the DOM; the callback resolves after the
          router's synchronous commit, so the NEW snapshot holds the
          destination. globals.css animates the root pair from data-nav.
          Kept minimal on purpose: tab order + depth fallback only.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
if(!("startViewTransition" in document))return;
var T=["/","/products","/favorites","/profile"];
function ix(p){p=(p||"").split(/[?#]/)[0];if(p==="/")return 0;for(var i=1;i<4;i++){if(p===T[i]||p.indexOf(T[i]+"/")===0)return i}return 4}
function dir(f,t){var a=ix(f),b=ix(t);if(a!==b)return b>a?"nav-forward":"nav-back";return t.split("/").length>=f.split("/").length?"nav-forward":"nav-back"}
function stamp(d){
var e=document.documentElement,rtl=e.dir==="rtl";
e.dataset.nav=d;
e.style.setProperty("--vt-old",d==="nav-forward"?(rtl?"vt-push-out-back":"vt-push-out-fwd"):(rtl?"vt-push-out-fwd":"vt-push-out-back"));
e.style.setProperty("--vt-new",d==="nav-forward"?(rtl?"vt-push-in-back":"vt-push-in-fwd"):(rtl?"vt-push-in-fwd":"vt-push-in-back"));
setTimeout(function(){e.style.removeProperty("--vt-old");e.style.removeProperty("--vt-new");delete e.dataset.nav},900);
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
window.addEventListener("popstate",function(){
var to=location.pathname,from=last;last=to;
if(from===to)return;
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
stamp(dir(from,to));
var t=document.startViewTransition(function(){return new Promise(function(r){setTimeout(r,140)})});
});
})();`,
          }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
