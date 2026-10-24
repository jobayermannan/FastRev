"""Train Logistic Regression and XGBoost models for FastRev no-show risk."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier


NUMERIC_FEATURES = [
    "patient_age",
    "prior_no_show_count",
    "total_appointment_count",
    "days_until_appointment",
    "hour_of_day",
]
CATEGORICAL_FEATURES = ["specialty"]
FEATURES = [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES]
TARGET = "no_show"
MODEL_VERSION = "xgboost-v1"
MIN_XGBOOST_F1 = 0.40


def make_preprocessor(scale_numeric: bool) -> ColumnTransformer:
    numeric_transformer = StandardScaler() if scale_numeric else "passthrough"
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_transformer, NUMERIC_FEATURES),
            ("specialty", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ]
    )


def best_f1_threshold(model: Pipeline, features: pd.DataFrame, labels: pd.Series) -> float:
    probabilities = model.predict_proba(features)[:, 1]
    candidates = [round(value / 100, 2) for value in range(10, 91, 2)]
    return max(
        candidates,
        key=lambda threshold: (f1_score(labels, probabilities >= threshold, zero_division=0), -threshold),
    )


def classification_metrics(
    model: Pipeline, features: pd.DataFrame, labels: pd.Series, threshold: float
) -> dict[str, float | int]:
    probabilities = model.predict_proba(features)[:, 1]
    predicted = (probabilities >= threshold).astype(int)
    true_negative, false_positive, false_negative, true_positive = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
    return {
        "threshold": threshold,
        "accuracy": round(float(accuracy_score(labels, predicted)), 4),
        "precision": round(float(precision_score(labels, predicted, zero_division=0)), 4),
        "recall": round(float(recall_score(labels, predicted, zero_division=0)), 4),
        "f1": round(float(f1_score(labels, predicted, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(labels, probabilities)), 4),
        "average_precision": round(float(average_precision_score(labels, probabilities)), 4),
        "true_negative": int(true_negative),
        "false_positive": int(false_positive),
        "false_negative": int(false_negative),
        "true_positive": int(true_positive),
    }


def build_models() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline([
            ("preprocessor", make_preprocessor(scale_numeric=True)),
            ("classifier", LogisticRegression(max_iter=1_000, class_weight="balanced", random_state=42)),
        ]),
        "xgboost": Pipeline([
            ("preprocessor", make_preprocessor(scale_numeric=False)),
            ("classifier", XGBClassifier(
                n_estimators=320,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.85,
                colsample_bytree=0.9,
                eval_metric="logloss",
                random_state=42,
                n_jobs=1,
            )),
        ]),
    }


def train(data: pd.DataFrame) -> tuple[Pipeline, dict[str, object]]:
    missing = set([*FEATURES, TARGET]) - set(data.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns: {', '.join(sorted(missing))}")

    train_validation_features, test_features, train_validation_labels, test_labels = train_test_split(
        data[FEATURES], data[TARGET], test_size=0.2, random_state=42, stratify=data[TARGET]
    )
    train_features, validation_features, train_labels, validation_labels = train_test_split(
        train_validation_features, train_validation_labels,
        test_size=0.25, random_state=42, stratify=train_validation_labels,
    )
    models = build_models()
    metrics: dict[str, dict[str, float | int]] = {}
    thresholds: dict[str, float] = {}
    fitted: dict[str, Pipeline] = {}
    for name, model in models.items():
        fitted[name] = model.fit(train_features, train_labels)
        thresholds[name] = best_f1_threshold(fitted[name], validation_features, validation_labels)
        metrics[name] = classification_metrics(fitted[name], test_features, test_labels, thresholds[name])

    if metrics["xgboost"]["f1"] < MIN_XGBOOST_F1:
        raise RuntimeError(f"XGBoost F1 {metrics['xgboost']['f1']} is below quality guard {MIN_XGBOOST_F1}")

    report: dict[str, object] = {
        "model_version": MODEL_VERSION,
        "dataset": "synthetic",
        "rows": int(len(data)),
        "positive_rate": round(float(data[TARGET].mean()), 4),
        "features": FEATURES,
        "train_test_split": {
            "train": int(len(train_features)), "validation": int(len(validation_features)),
            "test": int(len(test_features)), "random_state": 42,
        },
        "classification_threshold": thresholds["xgboost"],
        "quality_guard": {"minimum_xgboost_f1": MIN_XGBOOST_F1},
        "metrics": metrics,
        "trained_at": datetime.now(UTC).isoformat(),
    }
    return fitted["xgboost"], report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("data/synthetic_no_show_data.csv"))
    parser.add_argument("--model-output", type=Path, default=Path("models/no_show_model.joblib"))
    parser.add_argument("--metrics-output", type=Path, default=Path("models/training-metrics.json"))
    args = parser.parse_args()

    model, report = train(pd.read_csv(args.data))
    args.model_output.parent.mkdir(parents=True, exist_ok=True)
    args.metrics_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "metadata": report}, args.model_output)
    args.metrics_output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["metrics"], indent=2))
    print(f"Saved {report['model_version']} to {args.model_output}")


if __name__ == "__main__":
    main()
