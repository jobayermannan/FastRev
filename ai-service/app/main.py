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


def predict_probability(req: PredictRequest) -> tuple[float, str, float, str]:
    artifact = load_model_artifact()
    if artifact is None:
        return fallback_probability(req), "rule-v1", 0.5, "fallback_rule"

    try:
        metadata = artifact["metadata"]
        model = artifact["model"]
        threshold = float(metadata.get("classification_threshold", 0.5))
        probability = float(model.predict_proba(pd.DataFrame([req.model_dump(exclude={"appointment_id"})]))[0][1])
        return round(min(1.0, max(0.0, probability)), 3), str(metadata["model_version"]), threshold, "trained_model"
    except Exception:
        logger.exception("Trained model inference failed; using the deterministic fallback")
        return fallback_probability(req), "rule-v1", 0.5, "fallback_rule"

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
    probability, model_version, threshold, prediction_source = predict_probability(req)
    return PredictResponse(
        appointment_id=req.appointment_id,
        no_show_probability=probability,
        risk_level="high" if probability >= threshold else "low",
        model_version=model_version,
        prediction_source=prediction_source,
    )
