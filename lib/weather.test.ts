import { describe, expect, it, vi } from "vitest";

import { fetchLocalWeather, getWeatherDescription } from "./weather";

describe("getWeatherDescription", () => {
  it("maps WMO codes to the expected minimal condition labels", () => {
    expect(getWeatherDescription(0)).toBe("Clear sky");
    expect(getWeatherDescription(2)).toBe("Partly cloudy");
    expect(getWeatherDescription(45)).toBe("Foggy");
    expect(getWeatherDescription(55)).toBe("Drizzle");
    expect(getWeatherDescription(63)).toBe("Rain");
    expect(getWeatherDescription(75)).toBe("Snow");
    expect(getWeatherDescription(81)).toBe("Rain showers");
    expect(getWeatherDescription(85)).toBe("Snow showers");
    expect(getWeatherDescription(95)).toBe("Thunderstorm");
    expect(getWeatherDescription(96)).toBe("Thunderstorm with hail");
  });
});

describe("fetchLocalWeather", () => {
  it("fetches weather for the configured location", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 72.4,
          weathercode: 3,
          windspeed_10m: 9.8
        }
      })
    });

    await expect(
      fetchLocalWeather(fetchMock, {
        latitude: 39.9526,
        longitude: -75.1652,
        city: "Philadelphia"
      })
    ).resolves.toEqual({
      city: "Philadelphia",
      condition: "Partly cloudy",
      temperature: 72.4,
      weatherCode: 3,
      windSpeed: 9.8
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.open-meteo.com/v1/forecast?latitude=39.9526&longitude=-75.1652&current=temperature_2m%2Cweathercode%2Cwindspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph"
    );
  });

  it("throws when the weather request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false
    });

    await expect(
      fetchLocalWeather(fetchMock, {
        latitude: 39.9526,
        longitude: -75.1652,
        city: "Philadelphia"
      })
    ).rejects.toThrow(
      "Weather lookup failed"
    );
  });
});
