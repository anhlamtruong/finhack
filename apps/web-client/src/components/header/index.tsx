"use client";

import Link from "next/link";
import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import HeaderLogo from "./header-logo";
import Navigation from "./navigation";
import WelcomeMessage from "./welcome-message";
import Filters from "./filters";

import { Loader2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const routes = [
  { href: "/dashboard", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/companions", label: "Companions" },
  { href: "/theme-editor", label: "Themes" },
  { href: "/settings", label: "Settings" },
];

const Header = () => {
  return (
    <header className="bg-linear-to-b from-primary to-accent px-4 py-6 lg:px-14 pb-24 shadow-sm text-primary-foreground overflow-hidden">
      <div className="max-w-screen-2xl mx-auto relative z-10">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="w-full flex items-center justify-between mb-12 p-2 rounded-full border border-border/40 bg-background/80 shadow-2xl backdrop-blur-2xl supports-backdrop-filter:bg-background/60 dark:shadow-none text-foreground relative overflow-hidden group"
        >
          <motion.div
            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
            initial={{ x: "-150%" }}
            animate={{ x: "150%" }}
            transition={{
              repeat: Infinity,
              repeatType: "loop",
              duration: 3,
              ease: "easeInOut",
              repeatDelay: 3,
            }}
          />

          <div className="flex items-center lg:gap-x-16 px-2 relative z-10">
            <HeaderLogo />
            <div className="hidden lg:block">
              <Navigation />
            </div>
          </div>

          <div className="flex items-center gap-1 px-2 relative z-10">
            <ClerkLoaded>
              <UserButton />
            </ClerkLoaded>
            <ClerkLoading>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </ClerkLoading>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-muted-foreground hover:bg-accent/50 hover:text-primary transition-colors border-none"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-75">
                <SheetHeader>
                  <SheetTitle className="text-left font-bold text-xl text-primary mb-4">
                    Menu
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2">
                  {routes.map((route) => (
                    <Link
                      key={route.href}
                      href={route.href}
                      className="px-4 py-3 text-lg font-medium rounded-lg hover:bg-muted transition-colors"
                    >
                      {route.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </motion.div>

        <div className="flex flex-col gap-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <WelcomeMessage />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Filters />
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default Header;
