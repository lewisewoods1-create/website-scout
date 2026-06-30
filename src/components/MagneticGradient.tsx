import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface MagneticGradientProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function MagneticGradient({ children, className = '', onClick }: MagneticGradientProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
    };

    card.addEventListener('mousemove', handleMove);
    return () => card.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div ref={cardRef} className={`kpi-card ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
