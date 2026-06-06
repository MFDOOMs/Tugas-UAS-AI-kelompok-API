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
    visual: float = Field(..., ge=0, description="Average Visual score")
    auditory: float = Field(..., ge=0, description="Average Auditory score")
    kinesthetic: float = Field(..., ge=0, description="Average Kinesthetic score")


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
    if hasattr(scores, "model_dump"):
        return scores.model_dump()
    return scores.dict()


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

        return response
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"The model failed to process the input. Make sure it accepts visual, auditory, kinesthetic features. Error: {exc}",
        ) from exc
