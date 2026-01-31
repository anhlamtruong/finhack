"use client";

import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const WelcomeMessage = () => {
  const { user, isLoaded } = useUser();
  const [greeting, setGreeting] = useState("Welcome Back");

  useEffect(() => {
    const timer = setTimeout(() => {
      const hour = new Date().getHours();
      if (hour < 12) setGreeting("Good Morning");
      else if (hour < 18) setGreeting("Good Afternoon");
      else setGreeting("Good Evening");
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2 mb-2">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
        className="text-2xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2 group"
      >
        <motion.span
          className="inline-block"
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
          transition={{
            duration: 2.5,
            ease: "easeInOut",
            times: [0, 0.1, 0.3, 0.4, 0.6, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 3,
          }}
        >
          👋
        </motion.span>

        {greeting}
        {isLoaded ? (
          <span className="relative">
            {", "}
            <span className="bg-linear-to-r from-yellow-300 via-orange-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
              {user?.firstName}
            </span>
          </span>
        ) : (
          ""
        )}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />

        <p className="text-sm lg:text-base font-bold text-white/90 drop-shadow-md">
          Here is your real-time financial snapshot and AI insights.
        </p>
      </motion.div>
    </div>
  );
};

export default WelcomeMessage;
