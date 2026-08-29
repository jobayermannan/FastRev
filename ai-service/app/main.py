from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict
import os

app = FastAPI(title="FastRev AI Service")

class PredictRequest(BaseModel):
    appointment_id: str
    patient_age: int
    prior_no_show_count: int
    days_until_appointment: int
    hour_of_day: int
    specialty: str

class PredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    appointment_id: str
    no_show_probability: float
    risk_level: str
    model_version: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict/no-show-risk", response_model=PredictResponse)
def predict_no_show(req: PredictRequest):
    return PredictResponse(
        appointment_id=req.appointment_id,
        no_show_probability=0.5,
        risk_level="unknown",
        model_version="stub-v0"
    )
