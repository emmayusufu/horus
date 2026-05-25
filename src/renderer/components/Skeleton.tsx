interface SkeletonProps {
  lines?: number
  title?: boolean
  chart?: boolean
}

export function Skeleton({ lines = 3, title = true, chart = false }: SkeletonProps) {
  const bar = (w: string) => (
    <div className="bp6-skeleton" style={{ height: 14, width: w, borderRadius: 4, marginBottom: 8 }} />
  )

  return (
    <div style={{ padding: 4 }}>
      {title && bar('40%')}
      {chart && <div className="bp6-skeleton" style={{ height: 80, borderRadius: 6, marginBottom: 10 }} />}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i}>{bar(`${90 - i * 15}%`)}</div>
      ))}
    </div>
  )
}

export function CardSkeleton({ title = true, chart = false, lines = 2 }: SkeletonProps) {
  return (
    <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <Skeleton title={title} chart={chart} lines={lines} />
    </div>
  )
}
