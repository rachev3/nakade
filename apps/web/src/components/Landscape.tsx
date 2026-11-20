import { cn } from '@/lib/utils'

/**
 * Generic illustrated landscape used until we have licensed photos. Deterministic per `seed`
 * (e.g. the EKATTE code) so each place gets its own hills. Purely decorative.
 */
export function Landscape({
  seed,
  type = 'town',
  className,
}: {
  seed: string
  type?: 'town' | 'village'
  className?: string
}) {
  const n = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7)
  const r = (i: number, min: number, max: number) =>
    min + (((n * (i + 3) * 7919) % 1000) / 1000) * (max - min)

  const far = `M0 ${r(1, 70, 95)} Q ${r(2, 60, 120)} ${r(3, 25, 55)} ${r(4, 150, 210)} ${r(5, 55, 80)} T 400 ${r(6, 45, 75)} V 200 H 0 Z`
  const mid = `M0 ${r(7, 110, 135)} Q ${r(8, 90, 170)} ${r(9, 70, 100)} ${r(10, 220, 280)} ${r(11, 105, 125)} T 400 ${r(12, 95, 120)} V 200 H 0 Z`
  const near = `M0 ${r(13, 150, 165)} Q ${r(14, 120, 220)} ${r(15, 125, 145)} 400 ${r(16, 145, 160)} V 200 H 0 Z`
  const sunX = r(17, 60, 340)
  const baseY = r(18, 132, 142)

  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn('block h-full w-full bg-accent', className)}
    >
      <circle cx={sunX} cy={r(19, 40, 60)} r="18" fill="var(--clay)" opacity="0.85" />
      <path d={far} fill="var(--sage)" />
      <path d={mid} fill="var(--sage-deep)" />
      {type === 'town' ? (
        <g fill="var(--hill)" opacity="0.6">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const w = r(20 + i, 12, 22)
            const h = r(30 + i, 14, 34)
            const x = 150 + i * 20
            return <rect key={i} x={x} y={baseY - h} width={w} height={h + 30} rx="2" />
          })}
        </g>
      ) : (
        <g fill="var(--hill)" opacity="0.6">
          {[0, 1, 2].map((i) => {
            const x = 170 + i * 26
            const y = baseY - 2 + i * 3
            return <path key={i} d={`M${x} ${y} l10 -10 l10 10 v14 h-20 Z`} />
          })}
        </g>
      )}
      <path d={near} fill="var(--hill)" />
    </svg>
  )
}
