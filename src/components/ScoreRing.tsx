import { useEffect, useRef } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  className = '',
  showLabel = true,
}: ScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#10b981';
    if (s >= 60) return '#8b5cf6';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.strokeDashoffset = `${circumference}`;
      setTimeout(() => {
        if (circleRef.current) {
          circleRef.current.style.strokeDashoffset = `${offset}`;
        }
      }, 100);
    }
  }, [score, offset, circumference]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="score-ring"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="data-mono text-sm font-semibold" style={{ color: getColor(score) }}>
            {score}
          </span>
        </div>
      )}
    </div>
  );
}
