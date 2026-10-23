import unittest
from unittest.mock import patch
from pydantic import ValidationError

from app.main import PredictRequest, predict_no_show


class PredictionServiceTests(unittest.TestCase):
    def request(self, prior_no_show_count=0, total_appointment_count=0, days_until_appointment=2):
        return PredictRequest(
            appointment_id="appointment-1",
            patient_age=35,
            prior_no_show_count=prior_no_show_count,
            total_appointment_count=total_appointment_count,
            days_until_appointment=days_until_appointment,
            hour_of_day=10,
            specialty="General",
        )

    @patch("app.main.load_model_artifact", return_value=None)
    def test_falls_back_to_a_low_population_based_risk(self, _model):
        result = predict_no_show(self.request())
        self.assertEqual(result.no_show_probability, 0.21)
        self.assertEqual(result.risk_level, "low")
        self.assertEqual(result.model_version, "rule-v1")
        self.assertEqual(result.prediction_source, "fallback_rule")

    @patch("app.main.load_model_artifact", return_value=None)
    def test_fallback_increases_risk_for_prior_no_shows_and_long_lead_time(self, _model):
        result = predict_no_show(self.request(2, 2, 14))
        self.assertGreaterEqual(result.no_show_probability, 0.5)
        self.assertEqual(result.risk_level, "high")

    @patch("app.main.load_model_artifact")
    def test_uses_trained_model_probability_when_available(self, mock_model):
        class FakeModel:
            def predict_proba(self, _features):
                return [[0.31, 0.69]]

        mock_model.return_value = {
            "model": FakeModel(),
            "metadata": {"model_version": "xgboost-v1", "classification_threshold": 0.5},
        }

        result = predict_no_show(self.request())

        self.assertEqual(result.no_show_probability, 0.69)
        self.assertEqual(result.risk_level, "high")
        self.assertEqual(result.model_version, "xgboost-v1")
        self.assertEqual(result.prediction_source, "trained_model")

    def test_negative_history_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.request(prior_no_show_count=-1)


if __name__ == "__main__":
    unittest.main()
