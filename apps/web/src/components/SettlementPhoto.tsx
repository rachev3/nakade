import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Landscape } from '@/components/Landscape'
import { cn } from '@/lib/utils'

/** One entry of public/settlements/index.json (written by data/pipeline/fetch_images.py). */
type PhotoEntry = {
  src: string
  width: number | null
  height: number | null
  commons_page: string | null
  author: string
  licence: string
  credit: string
}

type PhotoIndex = { settlements: Record<string, PhotoEntry> }

function usePhotoIndex() {
  return useQuery({
    queryKey: ['settlement-photos'],
    queryFn: async (): Promise<PhotoIndex> => {
      const res = await fetch('/settlements/index.json')
      if (!res.ok) throw new Error(`settlement photos: HTTP ${res.status}`)
      return (await res.json()) as PhotoIndex
    },
    staleTime: Infinity,
    retry: false,
  })
}

/**
 * Wikimedia Commons photo of a settlement, with the author/licence credit its licence requires.
 * Falls back to the generated <Landscape> illustration while loading, when the settlement has no
 * photo, or when the image fails to load.
 */
export function SettlementPhoto({
  ekatte,
  type,
  eager = false,
  linkCredit = true,
  className,
}: {
  ekatte: string
  type?: 'town' | 'village'
  /** Load immediately (hero image) instead of lazily. */
  eager?: boolean
  /** Link the credit to the Commons page. Off inside draggable cards, where a link would steal the drag. */
  linkCredit?: boolean
  className?: string
}) {
  const index = usePhotoIndex()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const photo = index.data?.settlements[ekatte]

  if (!photo || failed) return <Landscape seed={ekatte} type={type} className={className} />

  const creditClass =
    'absolute right-0 bottom-0 max-w-[70%] truncate rounded-tl-md bg-black/45 px-2 py-0.5 text-[10px] leading-4 text-white/90'

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-accent', className)}>
      {/* The illustration shows through until the photo has loaded, then the photo fades in. */}
      <Landscape seed={ekatte} type={type} className="absolute inset-0" />
      <img
        src={photo.src}
        alt=""
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        // A cached image can finish loading before onLoad is attached, so also check on mount.
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true)
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'relative block h-full w-full object-cover transition-opacity duration-500 select-none',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      {linkCredit && photo.commons_page ? (
        <a
          href={photo.commons_page}
          target="_blank"
          rel="noopener noreferrer"
          title={`${photo.author} · ${photo.licence}`}
          className={cn(creditClass, 'hover:underline')}
        >
          {photo.credit}
        </a>
      ) : (
        <span title={`${photo.author} · ${photo.licence}`} className={creditClass}>
          {photo.credit}
        </span>
      )}
    </div>
  )
}
