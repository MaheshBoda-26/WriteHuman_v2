import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="border-t bg-card py-12">
      <div className="container">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="AI Humanizer" className="h-16 w-auto" />
          </div>

          <p className="text-sm text-muted-foreground">
            Built as a portfolio project • Showcasing full-stack development skills
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
