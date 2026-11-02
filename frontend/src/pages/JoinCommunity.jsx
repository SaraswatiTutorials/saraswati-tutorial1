import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { trackEvent } from "../utils/analytics";

// saraswatitutorial.com/join-community: a short link to the tutors' WhatsApp group.
// Once the page has fully loaded it forwards the visitor to the group.
export const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/BhAToFBis3W8yzzEMSHNU7";

// A moment after load so the page view and click are recorded before the visitor leaves
const REDIRECT_DELAY_MS = 800;

export default function JoinCommunity() {
  useEffect(() => {
    let timer;
    const goToGroup = () => {
      trackEvent("join_community_redirect");
      timer = setTimeout(() => window.location.replace(WHATSAPP_COMMUNITY_URL), REDIRECT_DELAY_MS);
    };

    if (document.readyState === "complete") goToGroup();
    else window.addEventListener("load", goToGroup, { once: true });

    return () => {
      window.removeEventListener("load", goToGroup);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] px-6 py-12 dark:bg-[#0b1120]">
      <Helmet>
        <title>Join our WhatsApp community | Saraswati Tutorials</title>
      </Helmet>

      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-500/10" />

      <div data-own-colors className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:shadow-black/40 dark:ring-white/10">
        <BrandLogo alt="Saraswati Tutorials" className="mx-auto h-12 w-12 rounded-xl object-contain" />

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30">
          <WhatsAppIcon className="h-8 w-8" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">Opening WhatsApp…</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Taking you to the Saraswati Tutorials tutor community for tuition leads.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting
        </div>

        <a
          href={WHATSAPP_COMMUNITY_URL}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white transition hover:bg-[#1ebe5b]"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Not opening? Tap here
        </a>
      </div>
    </div>
  );
}
