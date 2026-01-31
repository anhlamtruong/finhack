import Header from "@/components/header";
import { SheetAccountProvider } from "@/services/accounts/provider/sheet-account-provider";
import { SheetCategoryProvider } from "@/services/categories/provider/sheet-category-provider";
import { SheetTransactionsProvider } from "@/services/transactions/provider/sheet-transaction-provider";
import { Footer } from "@/services/homepage/components/footer";
import { CompanionProvider } from "@/services/ai-agent/provider/companion-provider";
import { FloatingCompanionHUD } from "@/services/ai-agent/components/floating-hud";

type Props = {
  children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
  return (
    <>
      <Header />
      <SheetAccountProvider />
      <SheetCategoryProvider />
      <SheetTransactionsProvider />
      <CompanionProvider>
        {children}
        <FloatingCompanionHUD />
      </CompanionProvider>
      <Footer />
    </>
  );
};

export default Layout;
