import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GOOGLE_PLACE_TYPE_FILTERS,
  MAP_PROVIDER_REQUEST_LIMITER,
  type GooglePlaceTypeFilter,
  type MapPlacePreview,
  type MapProvider,
  type MapProviderRequestLimiter,
} from '../../application/ports/care-directory.ports';

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
};

const PLACE_SEARCH_FIELDS =
  'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.attributions';
const PLACE_DETAILS_FIELDS =
  'id,displayName,formattedAddress,location,googleMapsUri,attributions';

@Injectable()
export class GooglePlacesAdapter implements MapProvider {
  constructor(
    private readonly config: ConfigService,
    @Inject(MAP_PROVIDER_REQUEST_LIMITER)
    private readonly requestLimiter: MapProviderRequestLimiter,
  ) {}

  async search(input: Parameters<MapProvider['search']>[0]) {
    const apiKey = this.apiKey();
    await this.requestLimiter.assertAllowed(input.actorId);
    if (input.placeType && !isGooglePlaceTypeFilter(input.placeType))
      throw new ServiceUnavailableException('MAP_PROVIDER_FILTER_INVALID');

    const query =
      input.query?.trim() ||
      (input.specialtyName?.trim()
        ? `${input.specialtyName.trim()} cơ sở y tế`
        : '');
    if (!query)
      throw new ServiceUnavailableException('MAP_SEARCH_QUERY_INVALID');
    const locationText = input.area?.trim()
      ? ` tại ${input.area.trim()}, Thành phố Hồ Chí Minh`
      : ' tại Thành phố Hồ Chí Minh';
    const body: Record<string, unknown> = {
      textQuery: `${query}${locationText}`,
      pageSize: 20,
      languageCode: 'vi',
      regionCode: 'VN',
    };
    if (input.placeType) {
      body.includedType = input.placeType;
      body.strictTypeFiltering = true;
    }
    if (input.location)
      body.locationBias = {
        circle: {
          center: {
            latitude: input.location.latitude,
            longitude: input.location.longitude,
          },
          radius: input.radiusKm * 1000,
        },
      };

    try {
      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_SEARCH_FIELDS,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error('provider_error');
      const result = (await response.json()) as { places?: PlaceResult[] };
      return (result.places ?? [])
        .slice(0, 20)
        .flatMap((place) => (place.id ? [toPreview(place)] : []));
    } catch {
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
  }

  async findPlace(placeId: string, actorId: string) {
    const apiKey = this.apiKey();
    await this.requestLimiter.assertAllowed(actorId);
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_DETAILS_FIELDS,
          },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error('provider_error');
      const place = (await response.json()) as PlaceResult;
      if (place.id && place.id !== placeId)
        throw new Error('provider_response_invalid');
      return toPreview(place, placeId);
    } catch {
      throw new ServiceUnavailableException('MAP_PROVIDER_UNAVAILABLE');
    }
  }

  private apiKey(): string {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY', '').trim();
    if (!key || !this.config.get<boolean>('GOOGLE_MAPS_PLACES_ENABLED', false))
      throw new ServiceUnavailableException('MAP_PROVIDER_DISABLED');
    return key;
  }
}

function isGooglePlaceTypeFilter(
  value: string,
): value is GooglePlaceTypeFilter {
  return (GOOGLE_PLACE_TYPE_FILTERS as readonly string[]).includes(value);
}

function toPreview(
  place: PlaceResult,
  fallbackPlaceId?: string,
): MapPlacePreview {
  const location = normalizedCoordinates(place.location);
  const thirdPartyAttributions = safeAttributions(place.attributions);
  return {
    placeId: place.id ?? fallbackPlaceId!,
    ...(place.displayName?.text
      ? { name: place.displayName.text.slice(0, 200) }
      : {}),
    ...(place.formattedAddress
      ? { address: place.formattedAddress.slice(0, 500) }
      : {}),
    ...(location ? { location } : {}),
    ...(place.googleMapsUri
      ? { mapsUrl: safeMapsUrl(place.googleMapsUri) }
      : {}),
    attribution: 'Google Maps',
    ...(thirdPartyAttributions.length ? { thirdPartyAttributions } : {}),
  };
}

function normalizedCoordinates(
  value: PlaceResult['location'],
): { longitude: number; latitude: number } | undefined {
  const latitude = value?.latitude;
  const longitude = value?.longitude;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude! < -90 ||
    latitude! > 90 ||
    longitude! < -180 ||
    longitude! > 180
  )
    return undefined;
  return { longitude: longitude!, latitude: latitude! };
}

function safeAttributions(
  values: PlaceResult['attributions'],
): Array<{ provider: string; providerUrl?: string }> {
  return (values ?? []).flatMap((item) => {
    const provider = item.provider?.trim().slice(0, 160);
    if (!provider) return [];
    const providerUrl = item.providerUri
      ? safeHttpsUrl(item.providerUri)
      : undefined;
    if (item.providerUri && !providerUrl) return [];
    return [{ provider, ...(providerUrl ? { providerUrl } : {}) }];
  });
}

function safeMapsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['www.google.com', 'maps.google.com'].includes(url.hostname.toLowerCase())
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function safeHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
