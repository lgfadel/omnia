"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TabItem {
  key: string | number;
  label: React.ReactNode;
  panel?: React.ReactNode;
}

interface SlidingTabsProps {
  items?: TabItem[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
}

export default function SlidingTabs({
  items = [
    { key: 0, label: "Overview", panel: "Overview content" },
    { key: 1, label: "Activity", panel: "Activity content" },
    { key: 2, label: "Settings", panel: "Settings content" },
  ],
  defaultIndex = 0,
  onChange,
  className,
}: SlidingTabsProps) {
  const [active, setActive] = React.useState<number>(defaultIndex);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(null);

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const activeBtn = tabRefs.current[active];
    if (!container || !activeBtn) return setIndicator(null);
    const cRect = container.getBoundingClientRect();
    const tRect = activeBtn.getBoundingClientRect();
    setIndicator({ left: tRect.left - cRect.left, width: tRect.width });
  }, [active]);

  React.useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    tabRefs.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  React.useEffect(() => {
    if (onChange) onChange(active);
  }, [active, onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      setActive((v) => Math.min(v + 1, items.length - 1));
    } else if (e.key === "ArrowLeft") {
      setActive((v) => Math.max(v - 1, 0));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(items.length - 1);
    }
  };

  return (
    <div className={cn("w-full mx-auto", className)}>
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Sliding tabs"
        onKeyDown={onKeyDown}
        className="relative inline-flex items-center gap-2 p-1 rounded-2xl bg-background/50 backdrop-blur-sm border border-border"
      >
        {indicator && (
          <motion.div
            layout
            initial={false}
            animate={{ left: indicator.left, width: indicator.width }}
            transition={{ type: "spring", stiffness: 250, damping: 30 }}
            className="absolute pointer-events-none rounded-lg"
            style={{ top: 6, height: `calc(100% - 12px)` }}
          >
            <motion.div
              initial={false}
              animate={{ opacity: 0.28 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 rounded-lg filter blur-2xl"
              style={{ background: "linear-gradient(90deg,#64748b,#94a3b8)" }}
            />
          </motion.div>
        )}

        {indicator && (
          <motion.div
            layout
            initial={false}
            animate={{ left: indicator.left, width: indicator.width }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="absolute pointer-events-none rounded-md"
            style={{
              top: 8,
              height: `calc(100% - 16px)`,
              background: "linear-gradient(90deg,#475569,#64748b)",
              mixBlendMode: "normal",
              opacity: 1,
            }}
          />
        )}

        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <Button
              key={item.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                "relative z-10 px-3 py-2 rounded-lg transition-colors hover:bg-transparent",
                isActive ? "text-white" : "text-foreground/80"
              )}
            >
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>

      <div className="mt-4">
        {items.map((item, i) => (
          <div
            key={item.key}
            role="tabpanel"
            aria-hidden={i !== active}
            hidden={i !== active}
          >
            {item.panel ?? null}
          </div>
        ))}
      </div>
    </div>
  );
}
