/// Persistence and remote evaluation lifecycle of a practice/mock attempt.
enum AttemptStatus {
  /// User is actively completing the session offline.
  inProgress,

  /// Session saved locally; objective parts scored or waiting upload.
  submittedLocal,

  /// Uploading audio object via presigned S3 URL.
  uploadingAudio,

  /// Enqueued in remote pg-boss worker pipeline (`evaluate` job active).
  queuedRemote,

  /// AI or local rubric evaluation finished and cached locally.
  scored,

  /// Failed remotely or during upload; user can tap retry without losing work.
  failedRetryable,
}

/// Primary IELTS skill domain.
enum SkillKind {
  /// Speaking parts 1, 2, 3.
  speaking,

  /// Writing Task 1 & Task 2.
  writing,

  /// Reading comprehension sections.
  reading,

  /// Listening audio sections.
  listening,

  /// Spaced-repetition lexical bank and drills.
  vocabulary,
}

/// Official IELTS test track.
enum ExamModuleType {
  /// Academic IELTS.
  academic,

  /// General Training IELTS.
  generalTraining,
}
