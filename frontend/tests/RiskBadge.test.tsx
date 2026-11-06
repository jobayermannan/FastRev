import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RiskBadge, StandbyBadge } from '@/components/RiskBadge';
import type { Prediction } from '@/lib/api/types';

const prediction = (over: Partial<Prediction>): Prediction => ({
  id: 'pr1',
  riskLevel: 'low',
  noShowProbability: 0.1,
  reasonCodes: [],
  ...over,
} as Prediction);

describe('RiskBadge', () => {
  it('shows the level and its probability', () => {
    render(<RiskBadge prediction={prediction({ riskLevel: 'high', noShowProbability: 0.71 })} />);
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
  });

  it('shows no percentage for a patient with no history to score', () => {
    render(<RiskBadge prediction={prediction({ riskLevel: 'new_patient', noShowProbability: null })} />);
    expect(screen.getByText('New patient')).toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('says the appointment is not scored when the AI service gave nothing back', () => {
    render(<RiskBadge prediction={null} />);
    expect(screen.getByText('Not scored')).toBeInTheDocument();
  });

  it('puts the reason codes in the tooltip, so a staff member can see why', () => {
    render(<RiskBadge prediction={prediction({ riskLevel: 'high', reasonCodes: ['past_no_shows', 'long_lead_time'] })} />);
    expect(screen.getByTitle(/past_no_shows, long_lead_time/)).toBeInTheDocument();
  });

  it('renders StandbyBadge with recommendation tooltip for high risk appointments', () => {
    render(<StandbyBadge probability={0.88} />);
    expect(screen.getByText('Standby Recommended')).toBeInTheDocument();
    expect(screen.getByTitle(/Smart Overbooking Recommendation: High no-show probability/)).toBeInTheDocument();
  });
});
