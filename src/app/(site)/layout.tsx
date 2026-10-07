import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatAssistant from "@/components/site/ChatAssistant";
import SiteTracking from "@/components/site/SiteTracking";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Without JS, Reveal's scroll-in animation never runs: show its content. */}
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <ChatAssistant />
      <SiteTracking />
    </>
  );
}
