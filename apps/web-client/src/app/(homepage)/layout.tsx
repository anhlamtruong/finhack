import { Navbar } from "@/services/homepage/components/navbar";
import { Footer } from "@/services/homepage/components/footer";

type Props = {
  children: React.ReactNode;
};

const HomepageLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 flex flex-col relative z-10">{children}</main>

      <Footer />
    </div>
  );
};

export default HomepageLayout;
