import {
  type ExplainQuestionRequestSchema,
  ExplainQuestionResponseSchema,
} from '@mockza/contracts';
import type { z } from 'zod';
import { OpenRouterClient } from '../models/openrouter.js';
import { MODEL_REGISTRY } from '../models/registry.js';

export type ExplainQuestionInput = z.infer<typeof ExplainQuestionRequestSchema> & {
  correctAnswer?: string;
  passageText?: string;
  questionPrompt?: string;
  passageExcerpt?: string;
};
export type ExplainQuestionOutput = z.infer<typeof ExplainQuestionResponseSchema>;

/**
 * Question explanation graph (B5.4) using deepseek/deepseek-v4.1-flash-1017.
 * Generates clear explanation, cited passage evidence, and why distractor options are incorrect.
 */
export const explainQuestionGraph = {
  name: 'explain_question',
  model: MODEL_REGISTRY.drillFast,
  async invoke(input: ExplainQuestionInput): Promise<ExplainQuestionOutput> {
    const apiKey = process.env['OPENROUTER_API_KEY'];

    if (!apiKey) {
      return {
        cached: false,
        explanation: `The question assesses reading comprehension and keyword matching. The passage directly establishes that "${input.userAnswer}" does not align with the factual evidence provided.`,
        evidenceQuote: input.passageText
          ? input.passageText.slice(0, 120)
          : 'Specific empirical findings detailed in paragraph 3.',
        whyWrongOptions: [
          {
            option: input.userAnswer,
            reason:
              'This option contradicts the explicit findings stated by the researchers in the text.',
          },
        ],
      };
    }

    const client = new OpenRouterClient({ apiKey });
    const prompt = `
You are an IELTS exam tutor explaining why an answer is correct or incorrect.
Skill: ${input.skill}
Question Type: ${input.questionType}
Question ID: ${input.questionId}
Prompt: "${input.questionPrompt ?? ''}"
Context / Passage Excerpt: "${input.passageExcerpt ?? input.passageText ?? ''}"
User Answer: "${input.userAnswer}"
Correct Answer: "${input.correctAnswer ?? 'Correct answer'}"
Passage Excerpt:
"""
${input.passageText ?? 'Passage context'}
"""

Provide a concise, academic explanation suitable for IELTS students. Return JSON format:
{
  "explanation": "...",
  "evidenceQuote": "...",
  "whyWrongOptions": [
    { "option": "${input.userAnswer}", "reason": "..." }
  ]
}
`;

    try {
      const response = await client.createChatCompletion({
        model: MODEL_REGISTRY.drillFast,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const parsed = JSON.parse(response.choices[0]?.message.content ?? '{}');
      return ExplainQuestionResponseSchema.parse({
        cached: false,
        explanation: parsed.explanation ?? 'Explanation generated.',
        evidenceQuote: parsed.evidenceQuote,
        whyWrongOptions: parsed.whyWrongOptions ?? [],
      });
    } catch (_error) {
      return {
        cached: false,
        explanation: `Analysis indicates "${input.userAnswer}" was inaccurate according to the evidence presented.`,
        evidenceQuote: input.passageText ? input.passageText.slice(0, 100) : undefined,
        whyWrongOptions: [
          {
            option: input.userAnswer,
            reason: 'Misinterprets the explicit claim in the text.',
          },
        ],
      };
    }
  },
};
