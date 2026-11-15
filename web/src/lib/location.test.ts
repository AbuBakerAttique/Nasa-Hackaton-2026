import { describe, expect, it, vi } from 'vitest';
import { currentLocation, locationErrorMessage } from './location';

describe('current location', () => {
  it('uses the device position without fabricating a fallback', async () => {
    const position = {coords:{latitude:52.52,longitude:13.4,accuracy:50}} as GeolocationPosition;
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position));
    expect(await currentLocation({getCurrentPosition})).toBe(position);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
  it('retries a timeout with coarse location and allows a cached fix', async () => {
    const position = {coords:{latitude:52.52,longitude:13.4,accuracy:500}} as GeolocationPosition;
    let attempts=0;
    const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if (++attempts===1) failure?.({code:3} as GeolocationPositionError); else success(position);
    });
    expect(await currentLocation({getCurrentPosition})).toBe(position);
    expect(getCurrentPosition.mock.calls).toHaveLength(2);
  });
  it('does not retry permission denial', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure?: PositionErrorCallback | null) => failure?.({code:1} as GeolocationPositionError));
    await expect(currentLocation({getCurrentPosition})).rejects.toMatchObject({code:1});
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(locationErrorMessage({code:1})).toContain('site settings');
  });
});
