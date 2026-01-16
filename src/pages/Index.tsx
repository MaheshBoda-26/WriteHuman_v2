import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import TextEditor from "@/components/TextEditor";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        
        <section className="pb-16">
          <div className="container">
            <TextEditor />
          </div>
        </section>

        <Features />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
