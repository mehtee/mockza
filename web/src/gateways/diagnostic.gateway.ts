import type {
  CreateDiagnosticSessionRequestSchema,
  DiagnosticBankResponseSchema,
  DiagnosticSessionResponseSchema,
  RetakeDiagnosticSkillRequestSchema,
  SubmitDiagnosticSessionRequestSchema,
} from '@mockza/contracts';
import type { DiagnosticSkill } from '@mockza/domain';
import type { RecordedClip } from './audio.gateway';
import type {
  NetworkError,
  QuotaExceededError,
  Result,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type DiagnosticBankDto = (typeof DiagnosticBankResponseSchema)['_output'];
export type DiagnosticBlockDto = DiagnosticBankDto['readingBlocks'][number];
export type CreateDiagnosticSessionInput = (typeof CreateDiagnosticSessionRequestSchema)['_output'];
export type SubmitDiagnosticSessionInput = (typeof SubmitDiagnosticSessionRequestSchema)['_output'];
export type RetakeDiagnosticSkillInput = (typeof RetakeDiagnosticSkillRequestSchema)['_output'];
export type DiagnosticSessionDto = (typeof DiagnosticSessionResponseSchema)['_output'];
export type DiagnosticSkillOutcomeDto = DiagnosticSessionDto['skills']['reading'];

export type { DiagnosticSkill };

export type DiagnosticGatewayError =
  | NetworkError
  | UnauthorizedError
  | QuotaExceededError
  | ValidationError
  | UnexpectedError;

export interface IDiagnosticGateway {
  fetchDiagnosticBank(): Promise<Result<DiagnosticBankDto, DiagnosticGatewayError>>;
  createSession(
    input: CreateDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>>;
  submitSession(
    diagId: string,
    input: SubmitDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>>;
  getSession(diagId: string): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>>;
  retakeSkill(
    diagId: string,
    input: RetakeDiagnosticSkillInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>>;
  uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly clip: RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, DiagnosticGatewayError>>;
}
