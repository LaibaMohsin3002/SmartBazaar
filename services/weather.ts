
'use server';

interface WeatherData {
    temp: number;
    feels_like: number;
    humidity: number;
    main: string;
    description: string;
    wind_speed: number;
}

interface ForecastData {
    date: string;
    temp_max: number;
    temp_min: number;
    main: string;
    description: string;
}

const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Fetches current weather data for a given city.
 * @param city The name of the city.
 * @returns A promise that resolves to the current weather data.
 */
export async function getCurrentWeather(city: string): Promise<WeatherData | null> {
    if (!API_KEY) {
        console.error("OpenWeatherMap API key is not set.");
        return null;
    }
    const url = `${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch weather data: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return {
            temp: data.main.temp,
            feels_like: data.main.feels_like,
            humidity: data.main.humidity,
            main: data.weather[0].main,
            description: data.weather[0].description,
            wind_speed: data.wind.speed,
        };
    } catch (error) {
        console.error("Error fetching current weather:", error);
        return null;
    }
}

/**
 * Fetches a 5-day weather forecast for a given city.
 * @param city The name of the city.
 * @returns A promise that resolves to an array of forecast data.
 */
export async function getWeatherForecast(city: string): Promise<ForecastData[] | null> {
     if (!API_KEY) {
        console.error("OpenWeatherMap API key is not set.");
        return null;
    }
    const url = `${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&units=metric`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch forecast data: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        
        // Process data to get one forecast per day
        const dailyForecasts: { [key: string]: ForecastData } = {};
        data.list.forEach((item: any) => {
            const date = item.dt_txt.split(' ')[0];
            if (!dailyForecasts[date]) {
                 dailyForecasts[date] = {
                    date: date,
                    temp_max: item.main.temp_max,
                    temp_min: item.main.temp_min,
                    main: item.weather[0].main,
                    description: item.weather[0].description,
                 };
            } else {
                dailyForecasts[date].temp_max = Math.max(dailyForecasts[date].temp_max, item.main.temp_max);
                dailyForecasts[date].temp_min = Math.min(dailyForecasts[date].temp_min, item.main.temp_min);
            }
        });

        return Object.values(dailyForecasts);

    } catch (error) {
        console.error("Error fetching weather forecast:", error);
        return null;
    }
}
