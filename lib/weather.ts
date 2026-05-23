export type LocalWeather = {
  city: string;
  condition: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
};

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type FetchLike = (input: string) => Promise<FetchResponse>;

type LocationPayload = {
  latitude: number;
  longitude: number;
  city: string;
};

type ForecastPayload = {
  current: {
    temperature_2m: number;
    weathercode: number;
    windspeed_10m: number;
  };
};

export function getWeatherDescription(weatherCode: number) {
  if (weatherCode === 0) {
    return "Clear sky";
  }

  if (weatherCode >= 1 && weatherCode <= 3) {
    return "Partly cloudy";
  }

  if (weatherCode >= 45 && weatherCode <= 48) {
    return "Foggy";
  }

  if (weatherCode >= 51 && weatherCode <= 57) {
    return "Drizzle";
  }

  if (weatherCode >= 61 && weatherCode <= 67) {
    return "Rain";
  }

  if (weatherCode >= 71 && weatherCode <= 77) {
    return "Snow";
  }

  if (weatherCode >= 80 && weatherCode <= 82) {
    return "Rain showers";
  }

  if (weatherCode >= 85 && weatherCode <= 86) {
    return "Snow showers";
  }

  if (weatherCode === 95) {
    return "Thunderstorm";
  }

  if (weatherCode >= 96 && weatherCode <= 99) {
    return "Thunderstorm with hail";
  }

  return "Weather unavailable";
}

function createForecastUrl(latitude: number, longitude: number) {
  const searchParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weathercode,windspeed_10m",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph"
  });

  return `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`;
}

export async function fetchLocalWeather(
  fetcher: FetchLike = (input) => fetch(input)
): Promise<LocalWeather> {
  const locationResponse = await fetcher("https://ipapi.co/json/");

  if (!locationResponse.ok) {
    throw new Error("Location lookup failed");
  }

  const locationPayload = (await locationResponse.json()) as LocationPayload;
  const forecastResponse = await fetcher(
    createForecastUrl(locationPayload.latitude, locationPayload.longitude)
  );

  if (!forecastResponse.ok) {
    throw new Error("Weather lookup failed");
  }

  const forecastPayload = (await forecastResponse.json()) as ForecastPayload;

  return {
    city: locationPayload.city,
    condition: getWeatherDescription(forecastPayload.current.weathercode),
    temperature: forecastPayload.current.temperature_2m,
    weatherCode: forecastPayload.current.weathercode,
    windSpeed: forecastPayload.current.windspeed_10m
  };
}
