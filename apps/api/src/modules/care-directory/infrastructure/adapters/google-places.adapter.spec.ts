import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GooglePlacesAdapter } from './google-places.adapter';

describe('GooglePlacesAdapter', () => {
  const config = {
    get: jest.fn(
      (key: string, fallback?: unknown) =>
        ({
          GOOGLE_MAPS_API_KEY: 'test-only-key',
          GOOGLE_MAPS_PLACES_ENABLED: true,
        })[key] ?? fallback,
    ),
  } as unknown as ConfigService;
  const limiter = { assertAllowed: jest.fn().mockResolvedValue(undefined) };

  afterEach(() => jest.restoreAllMocks());

  it('requests only display fields and returns a transient, attributed projection', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: 'place-1',
            displayName: { text: 'Synthetic Clinic' },
            formattedAddress: 'Synthetic address',
            location: { latitude: 10.7, longitude: 106.7 },
          },
        ],
      }),
    } as Response);
    const adapter = new GooglePlacesAdapter(config, limiter);
    const result = await adapter.search({
      actorId: 'synthetic-actor',
      specialtyName: 'Cardiology',
      area: 'Quận 1',
      radiusKm: 10,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.attributions',
        }),
      }),
    );
    expect(result).toEqual([
      {
        placeId: 'place-1',
        name: 'Synthetic Clinic',
        address: 'Synthetic address',
        location: { latitude: 10.7, longitude: 106.7 },
        attribution: 'Google Maps',
      },
    ]);
  });

  it('fails closed when provider access is disabled and maps upstream errors safely', async () => {
    const disabled = new GooglePlacesAdapter(
      { get: (_key: string, fallback?: unknown) => fallback } as ConfigService,
      limiter,
    );
    await expect(
      disabled.search({
        actorId: 'synthetic-actor',
        specialtyName: 'Cardiology',
        area: 'Quận 1',
        radiusKm: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('provider body must not escape'));
    const enabled = new GooglePlacesAdapter(config, limiter);
    await expect(
      enabled.search({
        actorId: 'synthetic-actor',
        specialtyName: 'Cardiology',
        area: 'Quận 1',
        radiusKm: 10,
      }),
    ).rejects.toThrow('MAP_PROVIDER_UNAVAILABLE');
  });

  it('searches by Admin query and applies only an allowlisted Google place type', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          { id: 'place-branch', displayName: { text: 'Minh An - Quan 3' } },
        ],
      }),
    } as Response);
    const adapter = new GooglePlacesAdapter(config, limiter);

    const result = await adapter.search({
      actorId: 'synthetic-admin',
      query: 'Phòng khám Minh An chi nhánh Quận 3',
      placeType: 'hospital',
      radiusKm: 10,
    });

    const requestBody = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({
      textQuery:
        'Phòng khám Minh An chi nhánh Quận 3 tại Thành phố Hồ Chí Minh',
      includedType: 'hospital',
      strictTypeFiltering: true,
    });
    expect(result).toEqual([
      {
        placeId: 'place-branch',
        name: 'Minh An - Quan 3',
        attribution: 'Google Maps',
      },
    ]);
  });

  it('keeps missing Place Details fields optional and sanitizes third-party attribution', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'place-partial',
        attributions: [
          {
            provider: 'Synthetic Source',
            providerUri: 'https://example.org/source',
          },
          { provider: 'Unsafe Source', providerUri: 'javascript:alert(1)' },
        ],
      }),
    } as Response);
    const adapter = new GooglePlacesAdapter(config, limiter);

    await expect(
      adapter.findPlace('place-partial', 'synthetic-admin'),
    ).resolves.toEqual({
      placeId: 'place-partial',
      attribution: 'Google Maps',
      thirdPartyAttributions: [
        {
          provider: 'Synthetic Source',
          providerUrl: 'https://example.org/source',
        },
      ],
    });
  });
});
