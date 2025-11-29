
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getCurrentWeather} from '@/services/weather';

const AgroGuruInputSchema = z.object({
  farmerQuery: z.string().describe("The farmer's question in either English or Urdu."),
  farmerContext: z.object({
    language: z.string().describe("The farmer's preferred language (e.g., 'en', 'ur')."),
    city: z.string().describe("The farmer's city for location-specific advice."),
    soilType: z.string().optional().describe("The farmer's primary soil type."),
    soilMoisture: z.number().optional().describe("The recent soil moisture reading."),
    phLevel: z.number().optional().describe("The recent soil pH level reading."),
    currentCrop: z.string().optional().describe("The crop the farmer is currently focused on."),
  }).describe("Contextual information about the farmer."),
});
export type AgroGuruInput = z.infer<typeof AgroGuruInputSchema>;

const AgroGuruOutputSchema = z.object({
  response: z.string().describe("The AI's helpful response to the farmer."),
  isRelevant: z.boolean().describe("Whether the farmer's query was related to farming."),
});
export type AgroGuruOutput = z.infer<typeof AgroGuruOutputSchema>;

export async function askAgroGuru(input: AgroGuruInput): Promise<AgroGuruOutput> {
  return agroGuruFlow(input);
}

const prompt = ai.definePrompt({
  name: 'agroGuruPrompt',
  input: {
    schema: z.object({
      farmerQuery: z.string(),
      farmerContext: AgroGuruInputSchema.shape.farmerContext,
      weather: z.string(),
    }),
  },
  output: {schema: AgroGuruOutputSchema},
  prompt: `You are "AgroGuru", a friendly and practical AI farming expert for Pakistani farmers. Your goal is to provide simple, actionable advice.

Respond in the same language as the farmer's query ({{farmerContext.language}}).

**Farmer's Information:**
- Location: {{farmerContext.city}}, Pakistan
- Current Crop: {{#if farmerContext.currentCrop}}{{farmerContext.currentCrop}}{{else}}Not specified{{/if}}
- Soil Type: {{#if farmerContext.soilType}}{{farmerContext.soilType}}{{else}}Not specified{{/if}}
- Soil Moisture: {{#if farmerContext.soilMoisture}}{{farmerContext.soilMoisture}}{{else}}Not available{{/if}}
- Soil pH: {{#if farmerContext.phLevel}}{{farmerContext.phLevel}}{{else}}Not available{{/if}}

**Current Weather in {{farmerContext.city}}:**
{{{weather}}}

**Farmer's Question:** "{{farmerQuery}}"

**Your Task:**
1.  **Analyze the farmer's question.**
2.  If the query is a simple greeting (like 'hello', 'hi', 'salam'), respond with a friendly greeting. For example: "Hello! I'm AgroGuru, your farming assistant. How can I help you today?" Set "isRelevant" to true.
3.  If the question is NOT about farming, agriculture, weather, or related topics (and is not a greeting), set "isRelevant" to false and politely redirect them. Your response should be something like: "My expertise is in farming. I can't help with that, but I can answer any agriculture-related questions you have."
4.  If the question is relevant to farming, use the farmer's information and the current weather to give a helpful, region-specific answer. Keep your language simple and avoid jargon.
5.  Conclude your farming-related answers with a warm closing sentence (e.g., "I hope this information is helpful for you!" or "Let me know if you have more questions.").
6.  Finally, always end your response with a small, practical tip or a daily reminder, prefixed with a plant emoji (🌱).

Generate the response.
`,
});

const agroGuruFlow = ai.defineFlow(
  {
    name: 'agroGuruFlow',
    inputSchema: AgroGuruInputSchema,
    outputSchema: AgroGuruOutputSchema,
  },
  async input => {
    const { farmerQuery, farmerContext } = input;

    // Fetch live weather data
    let weatherInfo = "Weather data not available.";
    if (farmerContext.city) {
        const weatherData = await getCurrentWeather(farmerContext.city);
        if (weatherData) {
            weatherInfo = `Temperature: ${weatherData.temp}°C (feels like ${weatherData.feels_like}°C), Humidity: ${weatherData.humidity}%, Wind: ${weatherData.wind_speed} m/s, Condition: ${weatherData.description}.`;
        }
    }

    const {output} = await prompt({
        farmerQuery,
        farmerContext,
        weather: weatherInfo,
    });

    return output!;
  }
);
