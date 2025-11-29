
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getWeatherForecast, getCurrentWeather} from '@/services/weather';
import type { UserDocument } from '@/lib/types';
import { format } from 'date-fns';


const DailyReportInputSchema = z.object({
  user: z.custom<UserDocument>(),
  crops: z.string().describe("A comma-separated list of crops the farmer is interested in."),
  location: z.string().optional().describe("The city for which to generate the report."),
  language: z.string().optional().describe("The language for the report (e.g., 'en', 'ur').")
});
export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const ReportDataSchema = z.object({
    dateTime: z.string().describe("The date of the report, e.g., 'October 18, 2025'"),
    location: z.string().describe("The farmer's location, e.g., 'Faisalabad, Punjab'"),
    weatherSummary: z.string().describe("A brief weather summary combining temperature, humidity, wind, and conditions. e.g., '33°C, Mostly Sunny, Humidity: 48%, Wind: 10 km/h'"),
    irrigationSuggestion: z.string().describe("A specific irrigation recommendation."),
    fertilizerAdvice: z.string().describe("Crop-specific fertilizer advice."),
    pestAndDiseaseAlerts: z.string().describe("Warnings about potential pests or diseases based on conditions."),
    cropHealthIndex: z.string().describe("An AI-computed score from 0-100, e.g., '82/100 (Good)'"),
    weatherAlerts: z.string().describe("Any urgent weather warnings from the forecast, e.g., 'Rain expected tonight; avoid spraying pesticides.' or 'No immediate alerts.'"),
    aiRecommendation: z.string().describe("A smart, practical tip that changes daily."),
});


const DailyReportOutputSchema = z.object({
  reportData: ReportDataSchema.describe("A JSON object containing the structured daily report."),
});
export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

export async function generateDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
  return dailyReportFlow(input);
}


const prompt = ai.definePrompt({
  name: 'dailyReportPrompt',
  input: {
    schema: z.object({
      farmerContext: z.any(),
      currentWeather: z.string(),
      forecast: z.string(),
      crops: z.string(),
    })
  },
  output: {schema: DailyReportOutputSchema},
  prompt: `You are "AgroGuru Daily Analyst", an AI that generates daily farming reports for farmers in Pakistan.
The report must be tailored to the specific crops the farmer is interested in.
Your response MUST be a JSON object that adheres to the provided schema. Do not output "unavailable"; make educated estimations if some data is missing.

If the user's requested language is 'ur', you MUST respond in Urdu using the Urdu script (Nastaliq), not Roman script.

**Farmer's Information:**
- Language Preference: {{farmerContext.language}}
- Location: {{farmerContext.location.city}}, Pakistan
- Crops of Interest: {{crops}}

**Current Weather in {{farmerContext.location.city}}:**
{{{currentWeather}}}

**Weather Forecast:**
{{{forecast}}}

**Your Task:**
Generate a structured JSON response containing the daily report. Fill out all fields of the 'reportData' object based on the provided information.
1.  **location**: The farmer's city and province.
2.  **weatherSummary**: Use the "Current Weather" data. Combine temp, humidity, wind, and condition into one line.
3.  **irrigationSuggestion**: Give a clear irrigation action based on the current weather and forecast.
4.  **fertilizerAdvice**: Provide a crop-specific fertilizer tip for the specified crops.
5.  **pestAndDiseaseAlerts**: Warn about potential pests based on weather (e.g., humidity, rain) for the specified crops. If none, state "No specific pest threats detected today."
6.  **cropHealthIndex**: Compute a score from 0-100 based on all available data (weather, pests). Add a qualitative rank (e.g., 'Good', 'Needs Attention'). Provide a realistic score.
7.  **weatherAlerts**: Note any significant upcoming weather events like rain or high winds from the "Weather Forecast" data. If none, state "No immediate weather alerts."
8.  **aiRecommendation**: Provide a unique, practical, and actionable tip of the day related to the farmer's specified crops.

Generate the JSON object now.
`,
});

const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (input) => {
    
    const reportCity = input.location || input.user.location?.city;
    let currentInfo = "Weather data not available.";
    let forecastInfo = "Weather forecast unavailable.";

    if (reportCity) {
      // Fetch both current weather and forecast
      const [currentData, forecastData] = await Promise.all([
          getCurrentWeather(reportCity),
          getWeatherForecast(reportCity)
      ]);
      
      // Process current weather data
      if (currentData) {
          currentInfo = `${Math.round(currentData.temp)}°C, ${currentData.main}, Humidity: ${currentData.humidity}%, Wind: ${currentData.wind_speed} m/s`;
      }

      // Process forecast data
      if (forecastData && forecastData.length > 0) {
        let forecastStrings: string[] = [];
        // Today
        if (forecastData[0]) {
            const today = forecastData[0];
            forecastStrings.push(`Today: ${today.main} (${Math.round(today.temp_min)}°C - ${Math.round(today.temp_max)}°C)`);
        }
        // Tomorrow
        if (forecastData[1]) {
            const tomorrow = forecastData[1];
            forecastStrings.push(`Tomorrow: ${tomorrow.main} (${Math.round(tomorrow.temp_min)}°C - ${Math.round(tomorrow.temp_max)}°C)`);
        }
        if (forecastStrings.length > 0) {
            forecastInfo = forecastStrings.join('. ');
        }
      }
    }

    // Prepare a clean user context for the prompt
    const farmerContext = {
      language: input.language || input.user.language || 'en',
      location: {
        city: reportCity || 'Not Specified',
        province: input.user.location?.province || '',
      },
    }

    const {output} = await prompt({
        farmerContext: farmerContext,
        currentWeather: currentInfo,
        forecast: forecastInfo,
        crops: input.crops,
    });
    
    // Ensure date is always set programmatically.
    if (output?.reportData) {
        output.reportData.dateTime = format(new Date(), 'MMMM d, yyyy');
    }
    
    return output!;
  }
);
