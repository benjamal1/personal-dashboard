"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Sun,
  Wind
} from "lucide-react";

import { fetchLocalWeather, type LocalWeather } from "@/lib/weather";

const WEATHER_CACHE_KEY = "personal-dashboard.weather";

type WeatherState =
  | {
      status: "loading";
      weather: null;
    }
  | {
      status: "error";
      weather: null;
    }
  | {
      status: "success";
      weather: LocalWeather;
    };

function getWeatherIcon(weatherCode: number): LucideIcon {
  if (weatherCode === 0) {
    return Sun;
  }

  if (weatherCode >= 1 && weatherCode <= 3) {
    return Cloud;
  }

  if (weatherCode >= 45 && weatherCode <= 48) {
    return Wind;
  }

  if (weatherCode >= 51 && weatherCode <= 57) {
    return Droplets;
  }

  if ((weatherCode >= 61 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return CloudRain;
  }

  if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    return CloudSnow;
  }

  if (weatherCode >= 95 && weatherCode <= 99) {
    return CloudLightning;
  }

  return Cloud;
}

export default function Weather() {
  const [state, setState] = useState<WeatherState>({
    status: "loading",
    weather: null
  });

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        const weather = await fetchLocalWeather();

        window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather));

        if (!cancelled) {
          setState({
            status: "success",
            weather
          });
        }
      } catch {
        const cachedWeather = readCachedWeather();

        if (!cancelled) {
          setState(
            cachedWeather
              ? {
                  status: "success",
                  weather: cachedWeather
                }
              : {
                  status: "error",
                  weather: null
                }
          );
        }
      }
    };

    void loadWeather();

    const intervalId = window.setInterval(() => {
      void loadWeather();
    }, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="mt-12 flex flex-col items-center text-center" aria-label="Loading weather">
        <div className="mx-auto my-10 h-px w-full max-w-xs bg-zinc-800/50" />
        <div className="h-9 w-24 animate-pulse bg-zinc-800/60" />
        <div className="mt-3 h-5 w-48 animate-pulse bg-zinc-900" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mt-12 flex flex-col items-center text-center">
        <div className="mx-auto my-10 h-px w-full max-w-xs bg-zinc-800/50" />
        <p className="text-base font-light text-zinc-600">Weather unavailable</p>
      </section>
    );
  }

  const { city, condition, temperature, weatherCode, windSpeed } = state.weather;
  const ConditionIcon = getWeatherIcon(weatherCode);

  return (
    <section className="mt-12 flex flex-col items-center text-center">
      <div className="mx-auto my-10 h-px w-full max-w-xs bg-zinc-800/50" />
      <p className="text-3xl font-light text-zinc-100">{Math.round(temperature)}°F</p>
      <p className="mt-3 flex items-center gap-2 font-light">
        <ConditionIcon
          className="h-4 w-4 shrink-0 text-zinc-500"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="text-sm text-zinc-300">{condition}</span>
        <span className="text-sm text-zinc-600" aria-hidden="true">
          ·
        </span>
        <span className="text-sm text-zinc-600">{city}</span>
      </p>
      <p className="mt-2 text-xs font-light text-zinc-700">{Math.round(windSpeed)} mph</p>
    </section>
  );
}

function readCachedWeather() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WEATHER_CACHE_KEY) || "null") as LocalWeather | null;

    if (
      parsed &&
      typeof parsed.city === "string" &&
      typeof parsed.condition === "string" &&
      typeof parsed.temperature === "number" &&
      typeof parsed.weatherCode === "number" &&
      typeof parsed.windSpeed === "number"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
