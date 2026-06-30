import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface FlipNumberProps {
  value: number;
  className?: string;
}

export default function FlipNumber({ value, className = '' }: FlipNumberProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const newDiv = document.createElement('div');
    newDiv.textContent = String(value);
    newDiv.style.position = 'absolute';
    newDiv.style.top = '100%';
    containerRef.current.appendChild(newDiv);

    gsap.to(containerRef.current.children, {
      y: '-100%',
      duration: 0.4,
      ease: 'power3.inOut',
      stagger: 0.05,
      onComplete: () => {
        containerRef.current?.firstElementChild?.remove();
      },
    });
  }, [value]);

  return (
    <span
      ref={containerRef}
      className={className}
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        height: '1.2em',
      }}
    >
      <div style={{ position: 'relative' }}>{value}</div>
    </span>
  );
}
