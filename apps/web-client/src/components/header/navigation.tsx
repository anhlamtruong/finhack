"use client";

import { usePathname, useRouter } from "next/navigation";
import { NavigationButton } from "./navigation-button";
import { useState } from "react";
import { useMedia } from "react-use";
import { LayoutGroup } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";

const routes = [
  { href: "/dashboard", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/reports", label: "Reports" },
  { href: "/companions", label: "Companions" },
  { href: "/theme-editor", label: "Themes" },
  { href: "/settings", label: "Settings" },
];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const isMobile = useMedia("(max-width: 1024px)", false);
  const pathname = usePathname();

  const onClick = (href: string) => {
    router.push(href);
    setIsOpen(false);
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-border/40 bg-background/80 px-3 shadow-sm backdrop-blur-xl hover:bg-accent/80 hover:text-primary transition-all dark:shadow-none"
          >
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="px-2">
          <SheetHeader>
            <SheetTitle className="text-left px-2">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Main navigation links
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-y-1.5 pt-6">
            {routes.map((route) => {
              const isActive = route.href === pathname;
              return (
                <Button
                  className="w-full justify-start font-medium transition-all"
                  key={route.href}
                  variant={isActive ? "secondary" : "ghost"}
                  onClick={() => onClick(route.href)}
                >
                  {route.label}
                </Button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <nav className="hidden lg:flex items-center gap-x-1 overflow-x-auto">
      <LayoutGroup>
        {routes.map((route) => (
          <NavigationButton
            key={route.href}
            href={route.href}
            label={route.label}
            isActive={pathname === route.href}
          />
        ))}
      </LayoutGroup>
    </nav>
  );
};

export default Navigation;
