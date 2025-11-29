
'use server';

/**
 * @fileOverview A flow to suggest a fair price for produce based on market data and other factors.
 *
 * - suggestFairPrice - A function that suggests a fair price for produce.
 * - SuggestFairPriceInput - The input type for the suggestFairPrice function.
 * - SuggestFairPriceOutput - The return type for the suggestFairPrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PriceHistorySchema = z.object({
  date: z.string().describe("The date of the price point in YYYY-MM-DD format."),
  price: z.number().describe("The average price for that day."),
  unit: z.string().describe("The unit for that price (e.g., '40 kg', 'kg')."),
});

const SuggestFairPriceInputSchema = z.object({
  cropName: z.string().describe('The name of the crop.'),
  listingUnit: z.string().describe("The unit the farmer wants to sell in (e.g., 'kg', 'maund')."),
  quantity: z.number().describe('The quantity of the produce being listed.'),
  location: z.string().describe('The location (province) where the produce is being sold.'),
  threeDayPriceHistory: z.array(PriceHistorySchema).describe("An array of the last 3 days' average prices for this crop in the specified location."),
  localSupplyCount: z.number().describe("The number of other active listings for the same crop in the same location."),
  buyerDemandCount: z.number().describe("The number of past orders for this crop, indicating buyer demand."),
});
export type SuggestFairPriceInput = z.infer<typeof SuggestFairPriceInputSchema>;

const SuggestFairPriceOutputSchema = z.object({
  suggestedPrice: z.number().describe('The suggested fair price for the produce, rounded to the nearest whole number.'),
  justification: z.string().describe('A brief, one-sentence justification for the suggested price, citing the data provided.'),
});
export type SuggestFairPriceOutput = z.infer<typeof SuggestFairPriceOutputSchema>;

export async function suggestFairPrice(input: SuggestFairPriceInput): Promise<SuggestFairPriceOutput> {
  return suggestFairPriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFairPricePrompt',
  input: {schema: SuggestFairPriceInputSchema},
  output: {schema: SuggestFairPriceOutputSchema},
  prompt: `You are an expert agricultural economist AI for a Pakistani marketplace app. Your task is to provide a fair market price suggestion for a farmer's produce listing.

You MUST calculate the price for the specific unit the farmer is listing ({{listingUnit}}). You will need to normalize the historical prices. For example, if history is "1000 PKR per 40 kg" and the farmer is selling "per kg", your suggested price must be for 1 kg. (1 Maund = 40 kg).

Analyze the following data to perform a regression analysis and determine a suggested price.

**Listing Details:**
- Crop Name: {{{cropName}}}
- Quantity Listed: {{{quantity}}} units
- Unit for Sale: {{{listingUnit}}}
- Location (Province): {{{location}}}

**Market Data:**
- **Recent Price History (last 3 days):** 
  {{#each threeDayPriceHistory}}
  - Date: {{date}}, Price: {{price}} PKR per {{unit}}
  {{/each}}
- **Local Supply:** There are currently {{localSupplyCount}} other farmers listing this crop in the same area.
- **Buyer Demand:** There have been {{buyerDemandCount}} orders for this crop recently.

**Your Task:**
1.  **Normalize Prices:** Convert all historical prices to a price per '{{listingUnit}}'.
2.  **Analyze Trends:** Look at the normalized price history. Is the price trending up, down, or is it stable?
3.  **Consider Supply and Demand:** A high local supply might push prices down. High buyer demand might push them up.
4.  **Factor in Harvest Timing:** Based on the current date, consider if it's early, peak, or late harvest season for the given crop in Pakistan. Early or late season produce often commands a higher price.
5.  **Determine Price:** Based on your analysis, suggest a final, single price per '{{listingUnit}}'.
6.  **Justify:** Provide a short, one-sentence justification for your price. This sentence MUST explicitly mention your analysis of the price trend (e.g., "upward trend"), supply (e.g., "low local supply"), demand (e.g., "high buyer demand"), or harvest timing if relevant. For example: "Price is slightly above average due to high buyer demand and a recent upward trend."

Return a JSON object with 'suggestedPrice' as a number (for one '{{listingUnit}}') and 'justification' as a single string sentence.
`,
});

const suggestFairPriceFlow = ai.defineFlow(
  {
    name: 'suggestFairPriceFlow',
    inputSchema: SuggestFairPriceInputSchema,
    outputSchema: SuggestFairPriceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (output) {
        // Ensure the price is a whole number.
        output.suggestedPrice = Math.round(output.suggestedPrice);
    }
    return output!;
  }
);
