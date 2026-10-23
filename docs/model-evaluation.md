# Model Evaluation

## Current model

`xgboost-v1` is the selected model. It was trained on **synthetic** data for a reproducible portfolio/demo pipeline, not clinical production data. Do not use these metrics to claim real-world clinic accuracy.

- Dataset rows: 12000
- Synthetic no-show prevalence: 0.1984
- Features: patient_age, prior_no_show_count, total_appointment_count, days_until_appointment, hour_of_day, specialty
- Train/validation/test split: 7200/2400/2400 (stratified, random state 42)
- Classification threshold: 0.18
- Training timestamp: 2026-10-17T13:57:57.715825+00:00

| Model | Precision | Recall | F1 | ROC-AUC | Average precision |
| --- | ---: | ---: | ---: | ---: | ---: |
| logistic_regression | 0.2847 | 0.6933 | 0.4037 | 0.6959 | 0.4162 |
| xgboost | 0.3287 | 0.5945 | 0.4233 | 0.6945 | 0.4195 |

## Test-set confusion matrix

| Model | True positive | False positive | True negative | False negative |
| --- | ---: | ---: | ---: | ---: |
| logistic_regression | 330 | 829 | 1095 | 146 |
| xgboost | 283 | 578 | 1346 | 193 |

## Quality guard

Training fails when XGBoost F1 falls below `0.4` on the fixed synthetic evaluation split. Once de-identified production data is available, replace this with a versioned holdout set and a comparison against the previously approved model.

## Operational use and limitations

The API uses the selected validation threshold to segment appointments as `high` or `low`. The score is intended to prioritize reminders and staff follow-up; it is not a clinical diagnosis or a reason to deny care. Current features are appointment history, lead time, appointment hour, specialty, and age. In the API, `total_appointment_count` is the number of past visits with a recorded outcome (completed or no-show), and patients with none are labelled `new_patient` instead of being scored. The model must be retrained and evaluated with consented, de-identified historical data before production use.
