'use server';

/**
 * @fileOverview Provides speech-to-text functionality using Genkit and the Web Speech API.
 *
 * - speechToTextFlow - A function that converts speech to text.
 * - SpeechToTextInput - The input type for the speechToTextFlow function.
 * - SpeechToTextOutput - The return type for the speechToTextFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SpeechToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Audio data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  languageCode: z
    .string()
    .optional()
    .describe('The language code of the audio, e.g., \'en-US\'.'),
});
export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;

const SpeechToTextOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text from the audio.'),
});
export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;

export async function speechToText(input: SpeechToTextInput): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}

const speechToTextPrompt = ai.definePrompt({
  name: 'speechToTextPrompt',
  input: {schema: SpeechToTextInputSchema},
  output: {schema: SpeechToTextOutputSchema},
  prompt: `Transcribe the following audio to text. The audio data is provided as a data URI.

Audio: {{media url=audioDataUri}}

{% if languageCode %}The language of the audio is {{languageCode}}.{% endif %}`,
});

const speechToTextFlow = ai.defineFlow(
  {
    name: 'speechToTextFlow',
    inputSchema: SpeechToTextInputSchema,
    outputSchema: SpeechToTextOutputSchema,
  },
  async input => {
    const {output} = await speechToTextPrompt(input);
    return output!;
  }
);
