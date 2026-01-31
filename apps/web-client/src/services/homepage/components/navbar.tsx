"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import HeaderLogo from "@/components/header/header-logo";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/60"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <HeaderLogo />
        </div>

        <div className="flex items-center gap-4">
          <SignedIn>
            <Link href="/dashboard">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:scale-105 active:scale-95">
                Go to Dashboard
              </Button>
            </Link>
          </SignedIn>

          <SignedOut>
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="font-medium hover:bg-transparent hover:text-primary transition-colors"
              >
                Log in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:scale-105 active:scale-95">
                Get Started
              </Button>
            </Link>
          </SignedOut>
        </div>
      </div>
    </motion.header>
  );
}
