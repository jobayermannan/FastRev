FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY training ./training
COPY models ./models

RUN python training/generate_synthetic_data.py --output /tmp/no_show_training.csv \
    && python training/train.py --data /tmp/no_show_training.csv --model-output /app/models/no_show_model.joblib --metrics-output /app/models/training-metrics.json

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
