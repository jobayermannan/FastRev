"""Create reproducible demo data for the FastRev no-show model.

This is deliberately synthetic. It is suitable for demonstrating the training
pipeline and must be replaced with de-identified, consented clinic data before
using the model to make production decisions.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


SPECIALTIES = ["General", "Dental", "Dermatology", "Cardiology", "Pediatrics"]


def generate_dataset(rows: int, seed: int) -> pd.DataFrame:
    if rows < 100:
        raise ValueError("rows must be at least 100")

    rng = np.random.default_rng(seed)
    age = np.clip(rng.normal(42, 17, rows).round(), 18, 90).astype(int)
    # Patients have heterogeneous attendance behavior. Their latent tendency is
    # never exposed as a feature; the model only sees historical appointments
    # and no-shows, as it would in the product.
    recurring_patient = rng.random(rows) < 0.55
    total_appointments = np.where(recurring_patient, rng.poisson(8, rows), rng.poisson(1, rows))
    total_appointments = total_appointments.clip(0, 24).astype(int)
    no_show_rate = rng.beta(2.0, 7.0, rows)
    prior_no_shows = np.array(
        [rng.binomial(total, rate) for total, rate in zip(total_appointments, no_show_rate, strict=True)]
    )
    days_until = rng.choice(
        [1, 2, 3, 5, 7, 10, 14, 21, 30], rows,
        p=[0.15, 0.15, 0.14, 0.13, 0.12, 0.10, 0.09, 0.07, 0.05],
    )
    hour = rng.choice(np.arange(8, 19), rows, p=[0.06, 0.09, 0.12, 0.12, 0.10, 0.10, 0.10, 0.10, 0.09, 0.07, 0.05])
    specialty = rng.choice(SPECIALTIES, rows, p=[0.40, 0.18, 0.14, 0.13, 0.15])

    historical_rate = (prior_no_shows + 0.5) / (total_appointments + 3)
    log_odds = (
        -2.55
        + 4.10 * historical_rate
        + 0.012 * np.maximum(days_until - 7, 0)
        + 0.10 * np.isin(hour, [8, 18])
        # Interaction effects give the tree model a meaningful advantage over
        # a purely linear baseline, while remaining hypotheses to validate
        # against real clinic data later.
        + 1.75 * ((prior_no_shows >= 2) & (days_until >= 14))
        + 1.10 * ((age < 25) & (days_until >= 7))
        + 1.00 * ((specialty == "Dental") & np.isin(hour, [8, 18]))
        + rng.normal(0, 0.28, rows)
    )
    probability = 1 / (1 + np.exp(-log_odds))
    no_show = rng.binomial(1, probability)

    return pd.DataFrame({
        "patient_age": age,
        "prior_no_show_count": prior_no_shows,
        "total_appointment_count": total_appointments,
        "days_until_appointment": days_until,
        "hour_of_day": hour,
        "specialty": specialty,
        "no_show": no_show,
    })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/synthetic_no_show_data.csv"))
    parser.add_argument("--rows", type=int, default=12_000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    data = generate_dataset(args.rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(args.output, index=False)
    print(f"Wrote {len(data)} synthetic appointments to {args.output}; no-show rate={data.no_show.mean():.3f}")


if __name__ == "__main__":
    main()
