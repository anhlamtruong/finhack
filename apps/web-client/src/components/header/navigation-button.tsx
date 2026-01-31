import Link from "next/link";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Props = {
  href: string;
  label: string;
  isActive?: boolean;
  className?: string;
};

export const NavigationButton = ({
  href,
  label,
  className,
  isActive,
}: Props) => {
  return (
    <Button
      asChild
      size={"lg"}
      variant={"ghost"}
      className={cn(
        "relative w-full lg:w-auto font-medium transition-colors focus-visible:ring-offset-0 focus-visible:ring-transparent px-6 rounded-full hover:bg-transparent",
        isActive
          ? "text-primary-foreground"
          : "text-muted-foreground hover:text-primary",
        className
      )}
    >
      <Link href={href}>
        {isActive && (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 z-0 rounded-full bg-primary shadow-lg shadow-primary/20"
            initial={false}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 35,
            }}
          />
        )}
        <span className="relative z-10">{label}</span>
      </Link>
    </Button>
  );
};
