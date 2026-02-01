"use client";

import { motion } from "framer-motion";
import { Sparkles, Palette, Presentation } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "AI-Powered Tracking",
    desc: "Stop doing data entry. Upload your bank CSVs and watch as our intelligent system automatically reconciles, matches, and categorizes your transactions for you.",
    icon: Sparkles,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Advanced Theme Engine",
    desc: "Don't settle for Light or Dark mode. Our real-time Theme Inspector lets you granularly adjust global colors, fonts, and border radii. Make your dashboard look exactly how you want it.",
    icon: Palette,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    title: "Interactive Insights",
    desc: "See the big picture instantly. Track your net worth, income, and spending habits through beautiful, interactive Area, Pie, and Bar charts that update in real-time.",
    icon: Presentation,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

export function Features() {
  return (
    <section className="py-24 sm:py-32 relative">
      <div className="container mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-6">
            Managing money shouldn&apos;t feel like a chore
          </h2>
          <p className="text-lg text-muted-foreground">
            We built FinHack Finance because existing tools are too rigid and
            require too much work. We believe your financial dashboard should be
            as smart, fast, and beautiful as the rest of the apps you love.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
            >
              <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group overflow-hidden">
                <CardHeader>
                  <div
                    className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.bg} ${feature.color} transition-transform group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <feature.icon className="h-7 w-7" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.desc}
                  </CardDescription>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-500" />
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
