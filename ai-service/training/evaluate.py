"""Render reproducible model-training metrics into the project model card."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def render_report(report: dict[str, object]) -> str:
    metrics = report["metrics"]
    assert isinstance(metrics, dict)
    rows = []
    confusion_rows = []
    for name in ("logistic_regression", "xgboost"):
        values = metrics[name]
        assert isinstance(values, dict)
        rows.append(
            f"| {name} | {values['precision']} | {values['recall']} | {values['f1']} | {values['roc_auc']} | {values['average_precision']} |"
        )
        confusion_rows.append(
            f"| {name} | {values['true_positive']} | {values['false_positive']} | {values['true_negative']} | {values['false_negative']} |"
        )
    split = report["train_test_split"]
    assert isinstance(split, dict)
    return f"""# Model Evaluation

## Current model

`{report['model_version']}` is the selected model. It was trained on **synthetic** data for a reproducible portfolio/demo pipeline, not clinical production data. Do not use these metrics to claim real-world clinic accuracy.

- Dataset rows: {report['rows']}
- Synthetic no-show prevalence: {report['positive_rate']}
- Features: {', '.join(report['features'])}
- Train/validation/test split: {split['train']}/{split['validation']}/{split['test']} (stratified, random state {split['random_state']})
- Classification threshold: {report['classification_threshold']}
- Training timestamp: {report['trained_at']}

| Model | Precision | Recall | F1 | ROC-AUC | Average precision |
| --- | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(rows)}

## Test-set confusion matrix

| Model | True positive | False positive | True negative | False negative |
| --- | ---: | ---: | ---: | ---: |
{chr(10).join(confusion_rows)}

## Quality guard

Training fails when XGBoost F1 falls below `{report['quality_guard']['minimum_xgboost_f1']}` on the fixed synthetic evaluation split. Once de-identified production data is available, replace this with a versioned holdout set and a comparison against the previously approved model.

## Operational use and limitations

The API uses the selected validation threshold to segment appointments as `high` or `low`. The score is intended to prioritize reminders and staff follow-up; it is not a clinical diagnosis or a reason to deny care. Current features are appointment history, lead time, appointment hour, specialty, and age. The model must be retrained and evaluated with consented, de-identified historical data before production use.
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metrics", type=Path, default=Path("models/training-metrics.json"))
    parser.add_argument("--output", type=Path, default=Path("../docs/model-evaluation.md"))
    args = parser.parse_args()
    report = json.loads(args.metrics.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_report(report), encoding="utf-8")
    print(f"Wrote model evaluation report to {args.output}")


if __name__ == "__main__":
    main()
