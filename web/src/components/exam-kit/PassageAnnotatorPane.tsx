import { BookmarkPlus, Highlighter, MessageSquare, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MzButton } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { getActiveEditionCode } from '@/edition/edition-config';
import type { AnnotationColorCode, PassageAnnotationRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useOptionalDeps } from '@/spa/deps';

export interface PassageEvidenceSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly label?: string;
}

export interface PassageSegment {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
  readonly annotation: PassageAnnotationRecord | null;
  readonly isEvidence: boolean;
}

export interface PassageSelectionDraft {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly selectedText: string;
  readonly contextSentence: string;
}

export interface PassageAnnotatorPaneProps {
  readonly title?: string;
  readonly rawText: string;
  readonly annotations: readonly PassageAnnotationRecord[];
  readonly evidenceSpan?: PassageEvidenceSpan | null;
  readonly readOnly?: boolean;
  readonly onAddAnnotation?: (input: {
    readonly startOffset: number;
    readonly endOffset: number;
    readonly colorCode: AnnotationColorCode;
    readonly noteText: string | null;
  }) => void;
  readonly onUpdateAnnotationNote?: (annotationId: string, noteText: string | null) => void;
  readonly onDeleteAnnotation?: (annotationId: string) => void;
  readonly onSaveToVocab?: (draft: PassageSelectionDraft) => void;
}

const HIGHLIGHT_CLASSES: Record<AnnotationColorCode, string> = {
  yellow: 'bg-amber-300/35 text-text-primary border-b-2 border-amber-400',
  mint: 'bg-emerald-300/30 text-text-primary border-b-2 border-emerald-400',
  green: 'bg-emerald-300/30 text-text-primary border-b-2 border-emerald-400',
  coral: 'bg-rose-400/30 text-text-primary border-b-2 border-rose-400',
  pink: 'bg-rose-400/30 text-text-primary border-b-2 border-rose-400',
};

export function validateSpanBounds(
  startOffset: number,
  endOffset: number,
  textLength: number,
): { readonly startOffset: number; readonly endOffset: number } | null {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || textLength <= 0) {
    return null;
  }
  const start = Math.max(0, Math.min(textLength, startOffset));
  const end = Math.max(0, Math.min(textLength, endOffset));
  if (end <= start) return null;
  return { startOffset: start, endOffset: end };
}

export function extractContextSentence(
  rawText: string,
  startOffset: number,
  endOffset: number,
): string {
  const before = rawText.slice(0, startOffset);
  const after = rawText.slice(endOffset);
  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf('\n'),
  );
  const nextPeriod = after.search(/[.!?\n]/);
  const rawStart = sentenceStart === -1 ? 0 : sentenceStart + 1;
  const rawEnd = nextPeriod === -1 ? rawText.length : endOffset + nextPeriod + 1;
  return rawText.slice(rawStart, rawEnd).trim();
}

export function slicePassageSegments(
  rawText: string,
  annotations: readonly PassageAnnotationRecord[],
  evidenceSpan?: PassageEvidenceSpan | null,
): readonly PassageSegment[] {
  if (rawText.length === 0) return [];

  const activeAnnotations = annotations.filter(
    (ann) => ann.isDeleted !== 1 && validateSpanBounds(ann.startOffset, ann.endOffset, rawText.length) !== null,
  );
  const validEvidence = evidenceSpan
    ? validateSpanBounds(evidenceSpan.startOffset, evidenceSpan.endOffset, rawText.length)
    : null;

  const boundaries = new Set<number>([0, rawText.length]);
  for (const ann of activeAnnotations) {
    boundaries.add(Math.max(0, Math.min(rawText.length, ann.startOffset)));
    boundaries.add(Math.max(0, Math.min(rawText.length, ann.endOffset)));
  }
  if (validEvidence) {
    boundaries.add(validEvidence.startOffset);
    boundaries.add(validEvidence.endOffset);
  }

  const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
  const segments: PassageSegment[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i += 1) {
    const segStart = sortedPoints[i]!;
    const segEnd = sortedPoints[i + 1]!;
    if (segEnd <= segStart) continue;

    // Last-created active annotation wins visually if overlapping
    let matchedAnnotation: PassageAnnotationRecord | null = null;
    for (let j = activeAnnotations.length - 1; j >= 0; j -= 1) {
      const candidate = activeAnnotations[j]!;
      if (candidate.startOffset <= segStart && candidate.endOffset >= segEnd) {
        matchedAnnotation = candidate;
        break;
      }
    }

    const isEvidence =
      validEvidence !== null &&
      validEvidence.startOffset <= segStart &&
      validEvidence.endOffset >= segEnd;

    segments.push({
      startOffset: segStart,
      endOffset: segEnd,
      text: rawText.slice(segStart, segEnd),
      annotation: matchedAnnotation,
      isEvidence,
    });
  }

  return segments;
}

export function getUtf16SelectionOffsets(
  container: HTMLElement,
  selection: Selection | null,
): { readonly startOffset: number; readonly endOffset: number } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  let runningOffset = 0;
  let startOffset: number | null = null;
  let endOffset: number | null = null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const length = node.nodeValue?.length ?? 0;
    if (node === range.startContainer) {
      startOffset = runningOffset + range.startOffset;
    }
    if (node === range.endContainer) {
      endOffset = runningOffset + range.endOffset;
    }
    runningOffset += length;
    if (startOffset !== null && endOffset !== null) {
      break;
    }
    node = walker.nextNode();
  }

  if (startOffset === null || endOffset === null) return null;
  const minOffset = Math.min(startOffset, endOffset);
  const maxOffset = Math.max(startOffset, endOffset);
  return maxOffset > minOffset ? { startOffset: minOffset, endOffset: maxOffset } : null;
}

export function PassageAnnotatorPane({
  title,
  rawText,
  annotations,
  evidenceSpan = null,
  readOnly = false,
  onAddAnnotation,
  onUpdateAnnotationNote,
  onDeleteAnnotation,
  onSaveToVocab,
}: PassageAnnotatorPaneProps) {
  const deps = useOptionalDeps();
  const edition = deps?.edition ?? getActiveEditionCode();
  const t = createTranslator(edition);

  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const evidenceRef = useRef<HTMLElement | null>(null);

  const [selectionDraft, setSelectionDraft] = useState<PassageSelectionDraft | null>(null);
  const [noteInputOpen, setNoteInputOpen] = useState(false);
  const [noteDraftText, setNoteDraftText] = useState('');
  const [inspectedAnnotationId, setInspectedAnnotationId] = useState<string | null>(null);

  const segments = useMemo(
    () => slicePassageSegments(rawText, annotations, evidenceSpan),
    [annotations, evidenceSpan, rawText],
  );

  const inspectedAnnotation = useMemo(
    () =>
      annotations.find(
        (ann) => ann.annotationId === inspectedAnnotationId && ann.isDeleted !== 1,
      ) ?? null,
    [annotations, inspectedAnnotationId],
  );

  useEffect(() => {
    if (!evidenceSpan || !evidenceRef.current) return;
    evidenceRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [evidenceSpan]);

  const captureCurrentSelection = useCallback(() => {
    if (readOnly) return;
    const container = textContainerRef.current;
    if (!container || typeof window === 'undefined') return;
    const offsets = getUtf16SelectionOffsets(container, window.getSelection());
    if (!offsets) return;

    const selectedText = rawText.slice(offsets.startOffset, offsets.endOffset);
    if (selectedText.trim().length === 0) return;

    setInspectedAnnotationId(null);
    setNoteInputOpen(false);
    setNoteDraftText('');
    setSelectionDraft({
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
      selectedText,
      contextSentence: extractContextSentence(rawText, offsets.startOffset, offsets.endOffset),
    });
  }, [rawText, readOnly]);

  const commitHighlight = useCallback(
    (colorCode: AnnotationColorCode, noteText: string | null = null) => {
      if (!selectionDraft || !onAddAnnotation) return;
      onAddAnnotation({
        startOffset: selectionDraft.startOffset,
        endOffset: selectionDraft.endOffset,
        colorCode,
        noteText,
      });
      setSelectionDraft(null);
      setNoteInputOpen(false);
      setNoteDraftText('');
      window.getSelection()?.removeAllRanges?.();
    },
    [onAddAnnotation, selectionDraft],
  );

  // Desktop quick-highlight hotkey ('h') when a passage slice is selected
  useEffect(() => {
    if (!selectionDraft || noteInputOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'h' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const activeTag = (event.target as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      event.preventDefault();
      commitHighlight('yellow');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commitHighlight, noteInputOpen, selectionDraft]);

  return (
    <div data-testid="passage-annotator-pane" className="flex flex-col gap-3">
      {title ? <h3 className="text-base font-bold text-text-primary text-start">{title}</h3> : null}

      {/* Contextual Selection Toolbar */}
      {selectionDraft && !readOnly ? (
        <div
          data-testid="annotator-selection-popover"
          className="flex flex-wrap items-center gap-2 rounded-[var(--mz-radius-control)] border border-primary/50 bg-surface-alt p-2.5 shadow-sm"
        >
          <Highlighter className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="max-w-[180px] truncate text-xs font-medium text-text-primary">
            “{selectionDraft.selectedText}”
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="annotator-color-yellow"
              onClick={() => commitHighlight('yellow')}
              className="rounded-[var(--mz-radius-pill)] border border-amber-400/60 bg-amber-300/25 px-2.5 py-0.5 text-xs font-semibold text-text-primary hover:bg-amber-300/40"
            >
              {t('annotatorHighlightYellow')}
            </button>
            <button
              type="button"
              data-testid="annotator-color-mint"
              onClick={() => commitHighlight('mint')}
              className="rounded-[var(--mz-radius-pill)] border border-emerald-400/60 bg-emerald-300/25 px-2.5 py-0.5 text-xs font-semibold text-text-primary hover:bg-emerald-300/40"
            >
              {t('annotatorHighlightMint')}
            </button>
            <button
              type="button"
              data-testid="annotator-color-coral"
              onClick={() => commitHighlight('coral')}
              className="rounded-[var(--mz-radius-pill)] border border-rose-400/60 bg-rose-400/25 px-2.5 py-0.5 text-xs font-semibold text-text-primary hover:bg-rose-400/40"
            >
              {t('annotatorHighlightCoral')}
            </button>
            <button
              type="button"
              data-testid="annotator-note-toggle"
              onClick={() => setNoteInputOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 py-0.5 text-xs font-medium text-text-primary hover:bg-surface-hover"
            >
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              <span>{t('annotatorAddNoteAction')}</span>
            </button>
            {onSaveToVocab ? (
              <button
                type="button"
                data-testid="annotator-save-vocab-btn"
                onClick={() => {
                  onSaveToVocab(selectionDraft);
                  setSelectionDraft(null);
                }}
                className="inline-flex items-center gap-1 rounded-[var(--mz-radius-compact)] border border-primary/50 bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/25"
              >
                <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
                <span>{t('annotatorSaveVocabAction')}</span>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={t('workspaceShortcutsCloseAction')}
            onClick={() => setSelectionDraft(null)}
            className="ms-auto rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {noteInputOpen ? (
            <div className="mt-1 flex w-full items-center gap-2 pt-1">
              <input
                type="text"
                data-testid="annotator-note-input"
                value={noteDraftText}
                onChange={(e) => setNoteDraftText(e.target.value)}
                placeholder={t('annotatorNotePlaceholder')}
                className="h-8 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
              />
              <MzButton
                variant="primary"
                size="sm"
                data-testid="annotator-save-note-btn"
                onClick={() => commitHighlight('yellow', noteDraftText.trim() || null)}
              >
                {t('annotatorSaveNoteAction')}
              </MzButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Existing Highlight / Note Inspector */}
      {inspectedAnnotation && !readOnly ? (
        <div
          data-testid="annotator-inspector-popover"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-strong bg-bg-raised px-3 py-2 text-xs"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary">
              {rawText.slice(inspectedAnnotation.startOffset, inspectedAnnotation.endOffset)}
            </p>
            {inspectedAnnotation.noteText ? (
              <p className="mt-0.5 text-text-secondary">{inspectedAnnotation.noteText}</p>
            ) : null}
          </div>
          {onDeleteAnnotation ? (
            <MzButton
              variant="ghost"
              size="sm"
              data-testid="annotator-delete-btn"
              leadingIcon={<Trash2 className="h-3.5 w-3.5 text-error" aria-hidden="true" />}
              onClick={() => {
                onDeleteAnnotation(inspectedAnnotation.annotationId);
                setInspectedAnnotationId(null);
              }}
            >
              {t('annotatorRemoveHighlightAction')}
            </MzButton>
          ) : null}
          {onUpdateAnnotationNote ? (
            <MzButton
              variant="secondary"
              size="sm"
              onClick={() => {
                const nextNote = window.prompt(
                  t('annotatorNotePlaceholder'),
                  inspectedAnnotation.noteText ?? '',
                );
                if (nextNote !== null) {
                  onUpdateAnnotationNote(
                    inspectedAnnotation.annotationId,
                    nextNote.trim() || null,
                  );
                }
              }}
            >
              {t('annotatorAddNoteAction')}
            </MzButton>
          ) : null}
        </div>
      ) : null}

      {/* Canonical UTF-16 Passage Body */}
      <LtrExamBoundary>
        <div
          ref={textContainerRef}
          data-testid="passage-text-body"
          onMouseUp={captureCurrentSelection}
          onKeyUp={captureCurrentSelection}
          className="whitespace-pre-wrap text-[15px] leading-[1.75] text-text-primary select-text"
        >
          {segments.map((seg) => {
            const ann = seg.annotation;
            const highlightClass = ann ? HIGHLIGHT_CLASSES[ann.colorCode] : '';
            const evidenceClass = seg.isEvidence
              ? 'ring-2 ring-primary bg-primary/20 rounded-sm px-0.5'
              : '';

            if (!ann && !seg.isEvidence) {
              return <span key={`${seg.startOffset}-${seg.endOffset}`}>{seg.text}</span>;
            }

            return (
              <mark
                key={`${seg.startOffset}-${seg.endOffset}`}
                ref={seg.isEvidence && !evidenceRef.current ? evidenceRef : undefined}
                data-testid={
                  ann ? `annotation-span-${ann.annotationId}` : 'evidence-span-highlight'
                }
                data-start-offset={seg.startOffset}
                data-end-offset={seg.endOffset}
                title={ann?.noteText ?? evidenceSpan?.label ?? undefined}
                onClick={() => {
                  if (ann) {
                    setInspectedAnnotationId(ann.annotationId);
                  }
                }}
                className={[
                  'cursor-pointer rounded-[2px] px-0.5 text-inherit',
                  highlightClass,
                  evidenceClass,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {seg.text}
              </mark>
            );
          })}
        </div>
      </LtrExamBoundary>
    </div>
  );
}
