"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export function Security() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1]);

  return (
    <section
      ref={targetRef}
      className="py-32 bg-muted/50 overflow-hidden relative"
    >
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 bg-primary/5 pointer-events-none"
      />

      <div className="container mx-auto px-4 sm:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <motion.div style={{ scale, opacity }} className="lg:w-1/2 w-full">
            <div className="relative rounded-2xl bg-linear-to-br from-background to-muted border p-1 shadow-2xl">
              <div className="rounded-xl bg-card overflow-hidden h-100 flex items-center justify-center relative">
                <div className="absolute inset-0">
                  <img
                    src="https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=1000"
                    alt="Blockchain technology visualization"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-card via-transparent to-transparent" />

                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="h-32 w-32 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 flex items-center justify-center z-10"
                >
                  <ShieldCheck className="h-16 w-16 text-primary" />
                </motion.div>

                <motion.div
                  animate={{ y: [-10, 10, -10], x: [-5, 5, -5] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-10 right-10 bg-background/80 backdrop-blur border p-3 rounded-lg shadow-lg flex items-center gap-2"
                >
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">AES-256</span>
                </motion.div>
              </div>
            </div>
          </motion.div>

          <div className="lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-primary bg-primary/10 mb-6">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Power Under the Hood
              </div>
              <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-6 leading-tight">
                Built on cutting-edge technology
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                For users who care about speed, security, and the future.
              </p>

              <div className="space-y-6">
                {[
                  {
                    title: "Secure by Design",
                    desc: "100% type-safe architecture means your financial data is handled with strict precision.",
                  },
                  {
                    title: "Live Now: Chat with your data",
                    desc: "Chat directly with your financial data using our upcoming AI Advisor (e.g., How much did I spend on coffee this month?)",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex gap-4 p-4 rounded-xl hover:bg-background/80 transition-colors border border-transparent hover:border-border/50"
                  >
                    <div className="flex-none pt-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
