"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useMemo } from "react";

/**
 * Props for the CountingOdometer component.
 */
interface CountingOdometerProps {
  /**
   * The final numeric value to display.
   * The component will animate to this number on mount or when it changes.
   */
  value: number;

  /**
   * Duration of the animation in milliseconds.
   * A shorter duration feels "snappier", while longer feels more "mechanical".
   * @default 1500
   */
  duration?: number;

  /**
   * The height of a single digit row in 'rem' units.
   * **Crucial Prop:** This must roughly match the line-height/height of the font size
   * you set in `digitClassName`. If the numbers look cut off or misaligned, adjust this.
   * @default 8
   */
  digitHeight?: number;

  /**
   * CSS class for the outer container.
   * Useful for positioning or adding margins.
   */
  className?: string;

  /**
   * CSS class applied specifically to the text digits.
   * Use this to change font-size, font-weight, or color.
   * Example: "text-3xl font-bold text-primary"
   */
  digitClassName?: string;

  /**
   * Number of decimal places to show.
   * @default 0
   */
  decimals?: number;

  /**
   * Character to use for the decimal point.
   * @default "."
   */
  decimal?: string;

  /**
   * Character to use for the thousands separator.
   * @default ","
   */
  separator?: string;

  /**
   * String to prepend to the value (e.g., "$").
   */
  prefix?: string;

  /**
   * String to append to the value (e.g., "%").
   */
  suffix?: string;

  /**
   * Optional custom formatting function.
   * If provided, this overrides `decimals`, `decimal`, `separator`, `prefix`, and `suffix`.
   * Use this for complex formats like Currency or compact notation (1.2k).
   */
  formattingFn?: (value: number) => string;

  /**
   * Callback fired when the animation completes.
   */
  onEnd?: () => void;
}

// Generates an array [0, 1, ..., 9] used to build the vertical digit strips.
const DIGITS = Array.from({ length: 10 }, (_, i) => i);

// Adds extra rotations to the animation so it doesn't stop too abruptly.
const EXTRA_ITERS = 2;

/**
 * CountingOdometer
 *
 * A "slot machine" style number counter.
 * It animates individual digits scrolling vertically to reach their final value.
 *
 * Best used for:
 * - Dashboards
 * - Hero section statistics
 * - Financial summaries
 */
const CountingOdometer: React.FC<CountingOdometerProps> = ({
  value,
  duration = 1500,
  digitHeight = 8,
  className,
  digitClassName,
  decimals = 0,
  decimal = ".",
  separator = ",",
  prefix = "",
  suffix = "",
  formattingFn,
  onEnd,
}) => {
  const tracks = useRef<(HTMLDivElement | null)[]>([]);

  const formattedString = useMemo(() => {
    if (formattingFn) return formattingFn(value);

    const absValue = Math.abs(value);
    const valueStr = absValue.toFixed(decimals);
    const [integerPart, decimalPart] = valueStr.split(".");

    const formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      separator,
    );
    const result = decimalPart
      ? `${formattedInteger}${decimal}${decimalPart}`
      : formattedInteger;

    return `${prefix}${result}${suffix}`;
  }, [value, decimals, decimal, separator, prefix, suffix, formattingFn]);

  useEffect(() => {
    tracks.current = tracks.current.slice(0, formattedString.length);

    const timeoutId = window.setTimeout(() => {
      let digitIndex = 0;

      formattedString.split("").forEach((char, idx) => {
        const el = tracks.current[idx];
        if (!el) return;

        if (isNaN(parseInt(char, 10))) return;

        const digit = parseInt(char, 10);

        const total = (digitIndex + EXTRA_ITERS) * 10 + digit;

        el.style.transform = `translateY(-${total * digitHeight}rem)`;

        el.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0.2, 1)`;

        digitIndex++;
      });

      if (onEnd) {
        window.setTimeout(onEnd, duration);
      }
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [value, formattedString, duration, digitHeight, onEnd]);

  return (
    <div
      className={cn(
        "flex items-center justify-start overflow-hidden leading-none tracking-tight",

        "tabular-nums",

        "mask-[linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)]",
        className,
      )}
      style={{ height: `${digitHeight}rem` }}
    >
      {formattedString.split("").map((char, idx) => {
        const isDigit = !isNaN(parseInt(char, 10));

        if (!isDigit) {
          return (
            <span
              key={`static-${idx}`}
              className={cn(
                "flex items-center justify-center font-bold text-muted-foreground",
                digitClassName,
              )}
              style={{
                height: `${digitHeight}rem`,
                lineHeight: `${digitHeight}rem`,
              }}
            >
              {char}
            </span>
          );
        }

        return (
          <div
            key={`digit-${idx}`}
            className="relative overflow-hidden"
            style={{ height: `${digitHeight}rem`, width: "auto" }}
          >
            <div
              className="flex flex-col items-center will-change-transform"
              ref={(el) => {
                tracks.current[idx] = el;
              }}
            >
              {Array.from({ length: idx + EXTRA_ITERS + 5 }).flatMap(
                (_, cycle) =>
                  DIGITS.map((d) => (
                    <span
                      key={`${idx}-${cycle}-${d}`}
                      className={cn(
                        "flex items-center justify-center font-bold",
                        digitClassName,
                      )}
                      style={{
                        height: `${digitHeight}rem`,

                        lineHeight: `${digitHeight}rem`,
                      }}
                    >
                      {d}
                    </span>
                  )),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CountingOdometer;
