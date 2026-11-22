import type {
  PronunciationHistoryResponseSchema,
  PronunciationPracticeItemSchema,
  TtsSynthesizeRequestSchema,
  TtsSynthesizeResponseSchema,
} from '@mockza/contracts';
import type { RecordedClip } from './audio.gateway';
import type {
  EntitlementRequiredError,
  NetworkError,
  QuotaExceededError,
  Result,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type TtsSynthesizeInput = (typeof TtsSynthesizeRequestSchema)['_output'];
export type TtsSynthesizeResult = (typeof TtsSynthesizeResponseSchema)['_output'];
export type PronunciationPracticeItemDto = (typeof PronunciationPracticeItemSchema)['_output'];
export type PronunciationHistoryDto = (typeof PronunciationHistoryResponseSchema)['_output'];

export type SpeechPracticeGatewayError =
  | NetworkError
  | UnauthorizedError
  | QuotaExceededError
  | EntitlementRequiredError
  | ValidationError
  | UnexpectedError;

export interface ISpeechPracticeGateway {
  synthesizeTts(
    input: TtsSynthesizeInput,
  ): Promise<Result<{ readonly audioUrl: string; readonly meta: TtsSynthesizeResult }, SpeechPracticeGatewayError>>;
  submitPronunciationPractice(params: {
    readonly targetText: string;
    readonly practiceKind: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
    readonly sourceRefType?:
      | 'vocab_card'
      | 'reading_passage'
      | 'listening_feedback'
      | 'writing_feedback'
      | 'speaking_feedback'
      | 'coach'
      | 'custom';
    readonly sourceRefId?: string;
    readonly examTrack: string;
    readonly clip: RecordedClip;
  }): Promise<Result<PronunciationPracticeItemDto, SpeechPracticeGatewayError>>;
  listPronunciationHistory(params?: {
    readonly sourceRefId?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<Result<PronunciationHistoryDto, SpeechPracticeGatewayError>>;
  resolveAuthenticatedAudioUrl(
    relativeAudioPath: string,
  ): Promise<Result<string, SpeechPracticeGatewayError>>;
}
