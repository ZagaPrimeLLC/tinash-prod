import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatAssistant from "@/components/site/ChatAssistant";
import SiteTracking from "@/components/site/SiteTracking";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <ChatAssistant />
      <SiteTracking />
    </>
  );
}
