import { 
  GraduationCap, 
  Briefcase, 
  Mail, 
  BookOpen, 
  Newspaper, 
  Megaphone,
  Feather 
} from "lucide-react";

const purposeCards = [
  {
    icon: GraduationCap,
    title: "Academic",
    description: "Essays, research papers, dissertations",
  },
  {
    icon: Briefcase,
    title: "Business",
    description: "Reports, proposals, presentations",
  },
  {
    icon: Mail,
    title: "Email",
    description: "Professional correspondence",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    description: "Blogs, ads, social content",
  },
  {
    icon: Newspaper,
    title: "Journalism",
    description: "Articles, news pieces",
  },
  {
    icon: Feather,
    title: "Creative",
    description: "Stories, narratives, scripts",
  },
];

const Features = () => {
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">
            Tailored for Every Purpose
          </h2>
          <p className="text-muted-foreground">
            Select your writing context for optimized humanization
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {purposeCards.map((card) => (
            <div
              key={card.title}
              className="group rounded-xl border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-card-hover"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-1 font-semibold text-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
