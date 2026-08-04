/* eslint-disable @next/next/no-img-element */

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`brand-symbol ${className}`.trim()} aria-hidden="true">
      <img src="/icons/escala-ici-mark.webp" alt="" />
    </span>
  );
}
