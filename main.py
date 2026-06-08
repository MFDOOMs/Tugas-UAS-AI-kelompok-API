import pickle
from pathlib import Path
from typing import Any

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "model_gaya_belajar.pkl"
PROFILE_PDFS = {
    "Visual": BASE_DIR / "profile_pdfs" / "visual-profile.pdf",
    "Auditory": BASE_DIR / "profile_pdfs" / "auditory-profile.pdf",
    "Kinesthetic": BASE_DIR / "profile_pdfs" / "kinesthetic-profile.pdf",
}

app = FastAPI(
    title="AI-Based Learning Style Report",
    description="VAK questionnaire system for predicting student learning styles.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

_model: Any | None = None
_model_loaded_from: Path | None = None


class ScorePayload(BaseModel):
    visual: float = Field(..., ge=1, le=5, description="Average Visual score")
    auditory: float = Field(..., ge=1, le=5, description="Average Auditory score")
    kinesthetic: float = Field(..., ge=1, le=5, description="Average Kinesthetic score")
    answers: dict[str, int] | None = Field(
        default=None,
        description="Raw questionnaire answers keyed by question id, for response-pattern validation.",
    )


def load_model() -> Any | None:
    global _model, _model_loaded_from

    if not MODEL_PATH.exists():
        _model = None
        _model_loaded_from = None
        return None

    if _model is None or _model_loaded_from != MODEL_PATH:
        try:
            _model = joblib.load(MODEL_PATH)
        except Exception:
            with MODEL_PATH.open("rb") as model_file:
                _model = pickle.load(model_file)
        _model_loaded_from = MODEL_PATH

    return _model


def score_dict(scores: ScorePayload) -> dict[str, float]:
    return {
        "visual": round(float(scores.visual), 3),
        "auditory": round(float(scores.auditory), 3),
        "kinesthetic": round(float(scores.kinesthetic), 3),
    }


def answer_values(scores: ScorePayload) -> list[int]:
    if not scores.answers:
        return []
    return [int(value) for value in scores.answers.values() if 1 <= int(value) <= 5]


def dominant_score(scores: ScorePayload) -> tuple[str, float]:
    score_map = {
        "Visual": float(scores.visual),
        "Auditory": float(scores.auditory),
        "Kinesthetic": float(scores.kinesthetic),
    }
    label = max(score_map, key=score_map.get)
    return label, score_map[label]


def detect_pre_prediction_anomalies(scores: ScorePayload) -> list[str]:
    anomalies: list[str] = []
    score_values = list(score_dict(scores).values())
    score_spread = max(score_values) - min(score_values)
    values = answer_values(scores)

    if values:
        answer_counts = {value: values.count(value) for value in set(values)}
        most_repeated = max(answer_counts.values())
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        standard_deviation = variance ** 0.5

        if len(set(values)) == 1:
            anomalies.append(
                "All questionnaire items received the same score, so the response pattern is not reliable enough for classification."
            )
        elif most_repeated >= 12:
            anomalies.append(
                "Most questionnaire items received the same score, which may indicate straight-line answering."
            )

        if standard_deviation < 0.55:
            anomalies.append(
                "The answers have very low variation, so the model cannot read a clear learning preference pattern."
            )

    if score_spread < 0.35:
        anomalies.append(
            "Visual, Auditory, and Kinesthetic scores are too close to each other, so the result is considered inconclusive."
        )

    return list(dict.fromkeys(anomalies))


def detect_prediction_conflict(scores: ScorePayload, prediction: str) -> list[str]:
    score_map = {
        "Visual": float(scores.visual),
        "Auditory": float(scores.auditory),
        "Kinesthetic": float(scores.kinesthetic),
    }
    dominant_label, dominant_value = dominant_score(scores)
    predicted_score = score_map.get(prediction)

    if predicted_score is None:
        return []

    if dominant_label != prediction and dominant_value - predicted_score >= 0.8:
        return [
            f"The model predicted {prediction}, but the strongest questionnaire score is {dominant_label}. This conflict is flagged for review instead of producing a final profile."
        ]

    return []


def inconclusive_response(
    scores: ScorePayload,
    anomalies: list[str],
    probabilities: dict[str, float] | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "prediction": "Inconclusive",
        "scores": score_dict(scores),
        "source": "validation_layer",
        "profile_pdf_url": None,
        "anomalies": anomalies,
        "message": "The response pattern needs review before a reliable learning profile can be generated.",
    }

    if probabilities:
        response["probabilities"] = probabilities

    return response


def normalize_prediction(raw_prediction: Any) -> str:
    value = raw_prediction[0] if isinstance(raw_prediction, (list, tuple)) else raw_prediction

    if hasattr(value, "item"):
        value = value.item()

    label_map = {
        0: "Visual",
        1: "Auditory",
        2: "Kinesthetic",
        "0": "Visual",
        "1": "Auditory",
        "2": "Kinesthetic",
        "visual": "Visual",
        "auditory": "Auditory",
        "kinesthetic": "Kinesthetic",
        "v": "Visual",
        "a": "Auditory",
        "k": "Kinesthetic",
    }

    key = str(value).strip().lower()
    return label_map.get(key, str(value).strip().title())


def fallback_prediction(scores: ScorePayload) -> str:
    score_map = {
        "Visual": scores.visual,
        "Auditory": scores.auditory,
        "Kinesthetic": scores.kinesthetic,
    }
    return max(score_map, key=score_map.get)


def profile_pdf_url(prediction: str) -> str | None:
    if prediction not in PROFILE_PDFS:
        return None
    return f"/profile-pdf/{prediction.lower()}"


@app.get("/")
def serve_frontend() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/profile-pdf/{learning_style}")
def download_profile_pdf(learning_style: str) -> FileResponse:
    normalized_style = normalize_prediction([learning_style])
    pdf_path = PROFILE_PDFS.get(normalized_style)

    if pdf_path is None or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Profile PDF not found.")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{normalized_style} Profile.pdf",
    )


@app.post("/predict")
def predict_learning_style(scores: ScorePayload) -> dict[str, Any]:
    model = load_model()
    input_values = [[scores.visual, scores.auditory, scores.kinesthetic]]
    anomalies = detect_pre_prediction_anomalies(scores)

    if anomalies:
        return inconclusive_response(scores, anomalies)

    if model is None:
        prediction = fallback_prediction(scores)
        return {
            "prediction": prediction,
            "scores": score_dict(scores),
            "source": "rule_based_fallback",
            "profile_pdf_url": profile_pdf_url(prediction),
            "message": "Model file was not found. Place models/model_gaya_belajar.pkl to use Machine Learning prediction.",
        }

    try:
        raw_prediction = model.predict(input_values)

        prediction = normalize_prediction(raw_prediction)
        response = {
            "prediction": prediction,
            "scores": score_dict(scores),
            "source": "machine_learning_model",
            "profile_pdf_url": profile_pdf_url(prediction),
        }

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_values)[0]
            classes = getattr(model, "classes_", ["Visual", "Auditory", "Kinesthetic"])
            response["probabilities"] = {
                normalize_prediction([label]): round(float(prob), 4)
                for label, prob in zip(classes, probabilities)
            }

        conflicts = detect_prediction_conflict(scores, prediction)
        if conflicts:
            return inconclusive_response(scores, conflicts, response.get("probabilities"))

        return response
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"The model failed to process the input. Make sure it accepts visual, auditory, kinesthetic features. Error: {exc}",
        ) from exc
