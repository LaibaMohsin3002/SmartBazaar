'use server';
/**
 * @fileOverview Enables natural language search for produce listings.
 *
 * - generateSearchEmbeddings - A function that generates TF.js embeddings for natural language search.
 * - GenerateSearchEmbeddingsInput - The input type for the generateSearchEmbeddings function.
 * - GenerateSearchEmbeddingsOutput - The return type for the generateSearchEmbeddings function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSearchEmbeddingsInputSchema = z.object({
  query: z.string().describe('The natural language query to generate embeddings for.'),
});
export type GenerateSearchEmbeddingsInput = z.infer<typeof GenerateSearchEmbeddingsInputSchema>;

const GenerateSearchEmbeddingsOutputSchema = z.object({
  embeddings: z.array(z.number()).describe('The TF.js embeddings for the natural language query.'),
});
export type GenerateSearchEmbeddingsOutput = z.infer<typeof GenerateSearchEmbeddingsOutputSchema>;

export async function generateSearchEmbeddings(input: GenerateSearchEmbeddingsInput): Promise<GenerateSearchEmbeddingsOutput> {
  return generateSearchEmbeddingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSearchEmbeddingsPrompt',
  input: {schema: GenerateSearchEmbeddingsInputSchema},
  output: {schema: GenerateSearchEmbeddingsOutputSchema},
  prompt: `Generate TF.js embeddings for the following natural language query:\n\nQuery: {{{query}}}`,
});

const generateSearchEmbeddingsFlow = ai.defineFlow(
  {
    name: 'generateSearchEmbeddingsFlow',
    inputSchema: GenerateSearchEmbeddingsInputSchema,
    outputSchema: GenerateSearchEmbeddingsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
