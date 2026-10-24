import type { Prediction } from '../../api/types';
import { formatPercent } from '../../lib/format';

const LABELS = {
  high: 'High risk',
  low: 'Low risk',
  new_patient: 'New patient',
  unknown: 'Not scored',
} as const;

const HINTS = {
  high: 'Likely to miss this appointment. Gets reminders 48h and 4h before.',
  low: 'Likely to attend. Gets the standard 24h reminder.',
  new_patient: 'No attendance history yet, so no score. Scored automatically after the first recorded visit.',
  unknown: 'The AI service was unavailable. A retry is queued; the standard reminder still goes out.',
} as const;

export function RiskBadge({ prediction }: { prediction: Prediction | null }) {
  const level = prediction?.riskLevel ?? 'unknown';
  const probability = prediction?.noShowProbability ?? null;
  return (
    <span className={`badge risk-${level}`} title={HINTS[level]}>
      {LABELS[level]}
      {probability !== null && <span className="badge-detail">{formatPercent(probability)}</span>}
    </span>
  );
}
