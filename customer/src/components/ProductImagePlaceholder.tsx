/** Placeholder shown when a product has no imageUrl. Logo-style so you can replace with real images later. */
export default function ProductImagePlaceholder({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#262626" stroke="#404040" strokeWidth="1.5" />
      <path d="M22 20h8v24h-8V20zm0 0h14l-6 10 6 14H22" stroke="#737373" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
