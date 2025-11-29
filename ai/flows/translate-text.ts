
'use server';

/**
 * @fileOverview A flow to translate text into different languages.
 *
 * - translateText - A function that translates a given text string.
 * - TranslateTextInput - The input type for the translateText function.
 * - TranslateTextOutput - The return type for the translateText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranslateTextInputSchema = z.object({
  texts: z.record(z.string()),
  targetLanguage: z.string().describe('The target language for translation (e.g., "Urdu", "Sindhi").'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslationItemSchema = z.object({
    key: z.string().describe("The original key from the input JSON."),
    translatedText: z.string().describe("The translated text.")
});

const TranslateTextOutputSchema = z.object({
  translations: z.array(TranslationItemSchema).describe("An array of translated key-value pairs."),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;


export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const translateTextPrompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {schema: z.object({
    textsJSON: z.string(),
    targetLanguage: z.string(),
  })},
  output: {schema: TranslateTextOutputSchema},
  prompt: `Translate the text values of the following JSON object into {{targetLanguage}}.

Return your response as a JSON object containing a "translations" array. Each item in the array should be an object with a "key" and a "translatedText" property. The "key" must be the original key from the input, and "translatedText" must be the translated value.

Input JSON:
{{{textsJSON}}}

Example response format:
{
  "translations": [
    { "key": "some_key", "translatedText": "some translated text" },
    { "key": "another_key", "translatedText": "another translated text" }
  ]
}
`,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    const {output} = await translateTextPrompt({
        textsJSON: JSON.stringify(input.texts),
        targetLanguage: input.targetLanguage
    });
    return output!;
  }
);
