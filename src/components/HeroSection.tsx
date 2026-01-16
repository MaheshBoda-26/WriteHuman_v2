import { Badge } from "@/components/ui/badge";
import { Shield, Zap, Target } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden py-12">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 gap-2 px-4 py-2">
            <Zap className="h-3 w-3" />
            Portfolio Project
          </Badge>
          
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            AI Text{" "}
            <span className="text-gradient-hero">Humanizer</span>
          </h1>
          
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Transform AI-generated text into natural human writing while preserving 
            meaning and intent. Powered by advanced language models.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span>AI Detection Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span>Meaning Preserved</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              <span>Instant Results</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
