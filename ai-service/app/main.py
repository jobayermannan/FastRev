from functools import lru_cache
import logging
import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="FastRev AI Service")
logger = logging.getLogger(__name__)
DEFAULT_MODEL_PATH = Path("/app/models/no_show_model.joblib")


class PredictRequest(BaseModel):
    appointment_id: str
    patient_age: int = Field(ge=0, le=120)
    prior_no_show_count: int = Field(ge=0)
    total_appointment_count: int = Field(ge=0)
    days_until_appointment: int = Field(ge=0)
    hour_of_day: int = Field(ge=0, le=23)
    specialty: str


class PredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    appointment_id: str
    no_show_probability: float
    risk_level: str
    reason_codes: list[str] = Field(default_factory=list)
    model_version: str
    prediction_source: str


@lru_cache(maxsize=1)
def load_model_artifact() -> dict[str, Any] | None:
    """Load the versioned training artifact once, without taking down the API on failure."""
    model_path = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))
    if not model_path.is_file():
        logger.warning("No trained model found at %s; using the deterministic fallback", model_path)
        return None
    try:
        artifact = joblib.load(model_path)
        if not isinstance(artifact, dict) or "model" not in artifact or "metadata" not in artifact:
            raise ValueError("invalid model artifact")
        return artifact
    except Exception:
        logger.exception("Unable to load trained model; using the deterministic fallback")
        return None


def fallback_probability(req: PredictRequest) -> float:
    history_rate = (req.prior_no_show_count + 1) / (req.total_appointment_count + 5)
    lead_time_adjustment = 0.15 if req.days_until_appointment >= 14 else (
        0.05 if req.days_until_appointment >= 7 else 0.0
    )
    return round(min(1.0, max(0.0, 0.08 + 0.65 * history_rate + lead_time_adjustment)), 3)


def rule_reason_codes(req: PredictRequest) -> list[str]:
    """Deterministic risk drivers when using rule-v1 or a mock estimator."""
    codes: list[str] = []
    if req.prior_no_show_count >= 1 and (
        req.prior_no_show_count >= 2
        or req.prior_no_show_count / max(1, req.total_appointment_count) >= 0.25
    ):
        codes.append("past_no_shows")
    if req.days_until_appointment >= 14 or (req.days_until_appointment >= 7 and req.patient_age < 25):
        codes.append("long_lead_time")
    if req.hour_of_day in (8, 18):
        codes.append("early_or_late_hour")
    if req.patient_age < 25 and req.days_until_appointment >= 7:
        codes.append("young_adult_lead_time")
    return codes[:3]


def model_reason_codes(model: Any, req: PredictRequest, base_probability: float) -> list[str]:
    """Rank contributing features by counterfactual probability drop against low-risk baselines."""
    base_row = req.model_dump(exclude={"appointment_id"})
    candidates: list[tuple[str, dict[str, Any], bool, float]] = [
        ("past_no_shows", {**base_row, "prior_no_show_count": 0}, req.prior_no_show_count > 0, 0.03),
        ("long_lead_time", {**base_row, "days_until_appointment": 2}, req.days_until_appointment >= 7, 0.02),
        ("early_or_late_hour", {**base_row, "hour_of_day": 11}, req.hour_of_day in (8, 18), 0.02),
        ("young_adult_lead_time", {**base_row, "patient_age": 42}, req.patient_age < 25, 0.02),
        ("specialty_baseline", {**base_row, "specialty": "General"}, req.specialty != "General", 0.02),
    ]
    active = [(code, row, min_lift) for code, row, applicable, min_lift in candidates if applicable]
    if not active:
        return []

    try:
        cf_probs = model.predict_proba(pd.DataFrame([row for _, row, _ in active]))
        if len(cf_probs) != len(active):
            return rule_reason_codes(req)
        scored = [
            (base_probability - float(prob[1]), code)
            for (code, _, min_lift), prob in zip(active, cf_probs, strict=True)
            if (base_probability - float(prob[1])) >= min_lift
        ]
        scored.sort(reverse=True)
        return [code for _, code in scored[:3]]
    except Exception:
        return rule_reason_codes(req)


def predict_probability(req: PredictRequest) -> tuple[float, str, float, str, list[str]]:
    artifact = load_model_artifact()
    if artifact is None:
        prob = fallback_probability(req)
        return prob, "rule-v1", 0.5, "fallback_rule", rule_reason_codes(req)

    try:
        metadata = artifact["metadata"]
        model = artifact["model"]
        threshold = float(metadata.get("classification_threshold", 0.5))
        raw_prob = float(model.predict_proba(pd.DataFrame([req.model_dump(exclude={"appointment_id"})]))[0][1])
        prob = round(min(1.0, max(0.0, raw_prob)), 3)
        codes = model_reason_codes(model, req, raw_prob)
        return prob, str(metadata["model_version"]), threshold, "trained_model", codes
    except Exception:
        logger.exception("Trained model inference failed; using the deterministic fallback")
        prob = fallback_probability(req)
        return prob, "rule-v1", 0.5, "fallback_rule", rule_reason_codes(req)


@app.get("/health")
def health():
    artifact = load_model_artifact()
    return {
        "status": "ok",
        "model": {
            "status": "loaded" if artifact else "fallback",
            "version": artifact["metadata"].get("model_version") if artifact else "rule-v1",
        },
    }


@app.post("/predict/no-show-risk", response_model=PredictResponse)
def predict_no_show(req: PredictRequest):
    probability, model_version, threshold, prediction_source, reason_codes = predict_probability(req)
    risk_level = "high" if probability >= threshold else "low"
    return PredictResponse(
        appointment_id=req.appointment_id,
        no_show_probability=probability,
        risk_level=risk_level,
        reason_codes=reason_codes if risk_level == "high" else [],
        model_version=model_version,
        prediction_source=prediction_source,
    )
