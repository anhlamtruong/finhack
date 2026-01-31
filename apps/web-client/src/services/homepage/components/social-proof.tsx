"use client";

import { motion } from "framer-motion";

const brands = [
  {
    name: "Chase",
    url: "chase.com",
  },
  {
    name: "Bank of America",
    url: "bankofamerica.com",
  },
  {
    name: "Wells Fargo",
    url: "wellsfargo.com",
  },
  {
    name: "Citi",
    url: "citi.com",
  },
  {
    name: "American Express",
    url: "americanexpress.com",
  },
  {
    name: "Fidelity",
    url: "fidelity.com",
  },
  {
    name: "Robinhood",
    url: "robinhood.com",
  },
];

export function SocialProof() {
  return (
    <section className="border-y bg-muted/30 py-12 overflow-hidden">
      <div className="container mx-auto px-4 text-center">
        <p className="mb-10 text-lg font-extrabold uppercase tracking-wider text-muted-foreground">
          Securely connects with 12,000+ financial institutions
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="flex flex-wrap gap-8 md:gap-12 items-center justify-center"
        >
          {brands.map((brand, i) => (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-3 group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.2 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative h-20 w-20 flex items-center justify-center p-3 transition-colors"
              >
                <img
                  src={`https://www.google.com/s2/favicons?sz=128&domain=${brand.url}`}
                  alt={`${brand.name} logo`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </motion.div>
              <span className="text-base font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                {brand.name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
