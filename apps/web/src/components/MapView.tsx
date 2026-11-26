import { useTranslation } from 'react-i18next'
import type { NearbyPlace } from '@/api/types'
import { placeName } from '@/lib/format'
import { GoogleMap, type MapMarker } from './GoogleMap'

/** Place-detail map: the place itself (big pin) and the nearby settlements (small pins). */
export function MapView({
  lat,
  lon,
  name,
  nearby = [],
}: {
  lat: number
  lon: number
  name: string
  nearby?: NearbyPlace[]
}) {
  const { i18n } = useTranslation()
  const markers: MapMarker[] = [
    { id: 'self', lat, lon, title: name, primary: true, color: '#2f6b4c' },
    ...nearby.map((n) => ({
      id: n.settlement.ekatte,
      lat: n.settlement.lat,
      lon: n.settlement.lon,
      title: placeName(n.settlement, i18n.language),
      subtitle: n.settlement.hook,
      href: `/places/${n.settlement.ekatte}`,
      color: '#8a9a8f',
    })),
  ]
  return <GoogleMap markers={markers} />
}
