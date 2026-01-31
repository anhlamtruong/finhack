"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative isolate overflow-hidden bg-primary px-6 py-24 text-center shadow-2xl rounded-3xl sm:px-16"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-24 -left-24 h-75 w-75 bg-white/10 rounded-[40px] rotate-12 blur-3xl"
          />
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-primary-foreground sm:text-5xl relative z-10">
            Ready to take control of your financial future?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-foreground/80 relative z-10">
            Join the community of users who are making finance fun, visual, and
            automated.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mt-10 flex items-center justify-center gap-x-6 relative z-10"
          >
            <Link href="/sign-up">
              <Button
                size="lg"
                variant="secondary"
                className="h-14 px-8 text-lg font-bold shadow-lg"
              >
                Get Started Today
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
