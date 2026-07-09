import { useId } from "react";

import { cn } from "@/lib/utils";

/** Crisp vector mark — works on light and dark backgrounds (no baked black). */
export function JigoMark({ className }: { className?: string }) {
  const gid = `jigoBubble-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8 shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="2" y1="6" x2="38" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5A1F" />
          <stop offset="0.28" stopColor="#F5C542" />
          <stop offset="0.52" stopColor="#2DD4BF" />
          <stop offset="0.72" stopColor="#22D3EE" />
          <stop offset="0.88" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <path
        d="M8 10.5C8 7.462 10.462 5 13.5 5H26.5C29.538 5 32 7.462 32 10.5V22.5C32 25.538 29.538 28 26.5 28H18.2L12.8 33.2C12.05 33.92 10.8 33.39 10.8 32.35V28H13.5C10.462 28 8 25.538 8 22.5V10.5Z"
        fill={`url(#${gid})`}
      />
      <g stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="15.5" cy="14" r="1.4" fill="white" stroke="none" />
        <circle cx="22" cy="12.5" r="1.4" fill="white" stroke="none" />
        <circle cx="26.5" cy="17.5" r="1.4" fill="white" stroke="none" />
        <circle cx="20" cy="20.5" r="1.4" fill="white" stroke="none" />
        <circle cx="14.5" cy="20" r="1.4" fill="white" stroke="none" />
        <path d="M15.5 14L22 12.5M22 12.5L26.5 17.5M26.5 17.5L20 20.5M20 20.5L14.5 20M14.5 20L15.5 14M15.5 14L20 20.5" />
      </g>
    </svg>
  );
}

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  collapsed?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  collapsed = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <JigoMark className={markClassName} />
      {showWordmark && !collapsed && (
        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            J<span className="text-[#22D3EE]">i</span>go
          </span>
          <span className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            AI Workspace
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return <JigoMark className={className} />;
}
