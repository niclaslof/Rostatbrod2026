import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Schedule from "@/components/Schedule";
import MapExplorer from "@/components/MapExplorer";
import PlacesGuide from "@/components/PlacesGuide";
import Packing from "@/components/Packing";
import AlbumPanel from "@/components/AlbumPanel";
import Splitwise from "@/components/Splitwise";
import FAQ from "@/components/FAQ";
import Guestbook from "@/components/Guestbook";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top" className="pt-16">
        <Hero />
        <About />
        <Schedule />
        <MapExplorer />
        <PlacesGuide />
        <Packing />
        <AlbumPanel />
        <Splitwise />
        <FAQ />
        <Guestbook />
      </main>
      <Footer />
    </>
  );
}
