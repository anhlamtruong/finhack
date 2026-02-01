"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const HeaderLogo = () => {
  return (
    <Link href={"/"}>
      <motion.div
        className="flex items-center gap-1.5 md:gap-2"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="size-10 relative flex items-center justify-center">
          <Image
            src="/logo/logo.svg"
            alt="Logo"
            fill
            className="object-contain scale-140"
          />
        </div>
        <p className="hidden md:block font-semibold text-base md:text-xl text-foreground tracking-tight">
          FinHack Finance
        </p>
      </motion.div>
    </Link>
  );
};

export default HeaderLogo;
