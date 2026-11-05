import type { Prediction } from '@/lib/api/types';
import { formatPercent } from '@/lib/format';

const LEVELS = {
  high: {
    label: 'High risk',
    className: 'badge-alert',
    hint: 'Likely to miss this appointment. Gets reminders 48h and 4h before.',
  },
  low: {
    label: 'Low risk',
    className: 'badge-success',
    hint: 'Likely to attend. Gets the standard 24h reminder.',
  },
  new_patient: {
    label: 'New patient',
    className: 'badge-new',
    hint: 'No attendance history yet, so no score. Scored automatically after the first recorded visit.',
  },
  unknown: {
    label: 'Not scored',
    className: 'badge-neutral',
    hint: 'The AI service was unavailable. A retry is queued; the standard reminder still goes out.',
  },
} as const;

export function RiskBadge({ prediction }: { prediction: Prediction | null }) {
  const level = LEVELS[prediction?.riskLevel ?? 'unknown'];
  const probability = prediction?.noShowProbability ?? null;
  const reasons = prediction?.reasonCodes?.length ? `\nReasons: ${prediction.reasonCodes.join(', ')}` : '';
  return (
    <span className={`badge ${level.className}`} title={`${level.hint}${reasons}`}>
      {level.label}
      {probability !== null && <span className="tnum opacity-80">{formatPercent(probability)}</span>}
    </span>
  );
}
