"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { containerVariants, itemVariants } from "./animations";

const floatVariants: Variants = {
  animate: {
    y: [0, -15, 0],
    rotate: [0, 1, 0],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export function Hero() {
  return (
    <section className="flex flex-col">
      <div className="relative w-full overflow-hidden pt-20 pb-20 sm:pt-32 sm:pb-32 lg:pb-40">
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-40 dark:opacity-20"
          >
            <source src="/homepage/video-background.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/10 to-background" />
        </div>

        <div className="container mx-auto px-4 sm:px-8 relative z-10">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground bg-background/50 backdrop-blur-sm mb-8">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                New: Meet your AI Financial Assistant
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl mb-6 bg-clip-text bg-linear-to-b from-foreground to-foreground/70"
            >
              Master your money with <br />
              <span className="text-primary bg-clip-text">
                Clarity and Control
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-6 text-xl leading-8 text-muted-foreground max-w-2xl mx-auto"
            >
              Say goodbye to tedious spreadsheets and manual data entry.
              Chuchube Finance is the playful, AI-powered companion that
              automates your tracking, visualizes your wealth, and adapts to
              your unique aesthetic.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-x-6 w-full max-w-sm sm:max-w-none mx-auto"
            >
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="w-full h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105"
                >
                  Start your free trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="https://youtu.be/wlhLPSS2ic8">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 px-8 text-lg rounded-full border-2 hover:bg-accent/50 transition-all hover:scale-105"
                >
                  View Demo
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-8 pb-24">
        <motion.div
          variants={floatVariants}
          animate="animate"
          className="rounded-xl bg-linear-to-tr from-accent/20 to-primary/10 p-2 ring-1 ring-inset ring-foreground/10 lg:rounded-2xl lg:p-4 backdrop-blur-3xl"
        >
          <div className="rounded-xl overflow-hidden bg-card shadow-2xl ring-1 ring-foreground/10 aspect-video relative group">
            <div className="absolute top-0 left-0 right-0 h-12 border-b bg-muted/30 backdrop-blur-md flex items-center px-6 gap-4 z-20">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="h-6 w-48 bg-muted/50 rounded-md hidden sm:block" />
            </div>

            <div className="h-full w-full pt-12">
              {" "}
              <img
                src="/og-image.png"
                alt="Chuchube Finance Dashboard"
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-xl pointer-events-none" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
