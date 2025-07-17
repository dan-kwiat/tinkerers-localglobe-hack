const BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz"

const BASE32_CODES_DICT: { [key: string]: number } = {}
for (let i = 0; i < BASE32_CODES.length; i++) {
  BASE32_CODES_DICT[BASE32_CODES.charAt(i)] = i
}

const MIN_LAT = -90
const MAX_LAT = 90
const MIN_LON = -180
const MAX_LON = 180

export function boundingBox(hash_string: string) {
  let isLon = true,
    maxLat = MAX_LAT,
    minLat = MIN_LAT,
    maxLon = MAX_LON,
    minLon = MIN_LON,
    mid

  let hashValue = 0
  for (let i = 0, l = hash_string.length; i < l; i++) {
    const code = hash_string[i].toLowerCase()
    hashValue = BASE32_CODES_DICT[code]

    for (let bits = 4; bits >= 0; bits--) {
      const bit = (hashValue >> bits) & 1
      if (isLon) {
        mid = (maxLon + minLon) / 2
        if (bit === 1) {
          minLon = mid
        } else {
          maxLon = mid
        }
      } else {
        mid = (maxLat + minLat) / 2
        if (bit === 1) {
          minLat = mid
        } else {
          maxLat = mid
        }
      }
      isLon = !isLon
    }
  }
  return { minLat, minLon, maxLat, maxLon }
}

export function encode(
  latitude: number,
  longitude: number,
  numberOfChars: number
) {
  const chars = []
  let bits = 0,
    bitsTotal = 0,
    hash_value = 0,
    maxLat = MAX_LAT,
    minLat = MIN_LAT,
    maxLon = MAX_LON,
    minLon = MIN_LON,
    mid
  while (chars.length < numberOfChars) {
    if (bitsTotal % 2 === 0) {
      mid = (maxLon + minLon) / 2
      if (longitude > mid) {
        hash_value = (hash_value << 1) + 1
        minLon = mid
      } else {
        hash_value = (hash_value << 1) + 0
        maxLon = mid
      }
    } else {
      mid = (maxLat + minLat) / 2
      if (latitude > mid) {
        hash_value = (hash_value << 1) + 1
        minLat = mid
      } else {
        hash_value = (hash_value << 1) + 0
        maxLat = mid
      }
    }

    bits++
    bitsTotal++
    if (bits === 5) {
      const code = BASE32_CODES[hash_value]
      // @ts-expect-error - code is a string
      chars.push(code)
      bits = 0
      hash_value = 0
    }
  }
  return chars.join("")
}

export function decode(geohash: string): {
  latitude: number
  longitude: number
} {
  const { minLat, minLon, maxLat, maxLon } = boundingBox(geohash)

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  }
}
