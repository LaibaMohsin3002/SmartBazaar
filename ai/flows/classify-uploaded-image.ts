'use server';

/**
 * @fileOverview An image classification AI agent to determine the crop type from an uploaded image.
 *
 * - classifyUploadedImage - A function that handles the image classification process.
 * - ClassifyUploadedImageInput - The input type for the classifyUploadedImage function.
 * - ClassifyUploadedImageOutput - The return type for the classifyUploadedImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyUploadedImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a crop, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ClassifyUploadedImageInput = z.infer<typeof ClassifyUploadedImageInputSchema>;

const ClassifyUploadedImageOutputSchema = z.object({
  cropType: z.string().describe('The identified crop type from the image.'),
  confidence: z.number().describe('The confidence level of the classification (0-1).'),
});
export type ClassifyUploadedImageOutput = z.infer<typeof ClassifyUploadedImageOutputSchema>;

export async function classifyUploadedImage(input: ClassifyUploadedImageInput): Promise<ClassifyUploadedImageOutput> {
  return classifyUploadedImageFlow(input);
}

const classifyUploadedImagePrompt = ai.definePrompt({
  name: 'classifyUploadedImagePrompt',
  input: {schema: ClassifyUploadedImageInputSchema},
  output: {schema: ClassifyUploadedImageOutputSchema},
  prompt: `You are an expert in identifying crop types from images.

  Analyze the provided image and determine the crop type.  Also, provide a confidence level between 0 and 1 indicating how sure you are of your identification.

  Image: {{media url=photoDataUri}}
  `,
});

const classifyUploadedImageFlow = ai.defineFlow(
  {
    name: 'classifyUploadedImageFlow',
    inputSchema: ClassifyUploadedImageInputSchema,
    outputSchema: ClassifyUploadedImageOutputSchema,
  },
  async input => {
    const {output} = await classifyUploadedImagePrompt(input);
    return output!;
  }
);
