const form = document.querySelector("#quizForm");
const resultSection = document.querySelector("#resultSection");
const predictionTitle = document.querySelector("#predictionTitle");
const predictionDescription = document.querySelector("#predictionDescription");
const recommendationText = document.querySelector("#recommendationText");
const sourceBadge = document.querySelector("#sourceBadge");
const statusText = document.querySelector("#statusText");
const downloadBtn = document.querySelector("#downloadBtn");
const profilePdfBtn = document.querySelector("#profilePdfBtn");

const scoreFields = {
    visual: document.querySelector("#visualScore"),
    auditory: document.querySelector("#auditoryScore"),
    kinesthetic: document.querySelector("#kinestheticScore"),
};

const apiUrl = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/predict"
    : `${window.location.origin}/predict`;

const scaleLabels = {
    1: "Strongly disagree",
    2: "Disagree",
    3: "Neutral",
    4: "Agree",
    5: "Strongly agree",
};

const descriptions = {
    Visual: "Your responses indicate a stronger tendency toward visual and reading-based learning, where written material, diagrams, and visible structure support understanding.",
    Auditory: "Your responses indicate a stronger tendency toward auditory learning, where spoken explanation, listening, and discussion support understanding.",
    Kinesthetic: "Your responses indicate a stronger tendency toward kinesthetic learning, where direct practice, experiments, movement, and hands-on activities support understanding.",
};

const recommendations = {
    Visual: "Use structured notes, diagrams, mind maps, reading summaries, highlighted keywords, and visual organizers to make information easier to scan and remember.",
    Auditory: "Use discussion, verbal explanation, recorded summaries, lecture-based material, and teach-back sessions to strengthen recall and understanding.",
    Kinesthetic: "Use practice tasks, experiments, simulations, role-playing, case studies, and project-based activities to make concepts more concrete.",
};

document.querySelectorAll(".scale").forEach((scale) => {
    const question = scale.dataset.question;

    for (let value = 1; value <= 5; value += 1) {
        const label = document.createElement("label");
        label.innerHTML = `
            <input type="radio" name="${question}" value="${value}" required>
            <b>${value}</b>
            <small>${scaleLabels[value]}</small>
        `;
        scale.appendChild(label);
    }
});

function collectScores() {
    const totals = {
        visual: 0,
        auditory: 0,
        kinesthetic: 0,
    };
    const counts = {
        visual: 0,
        auditory: 0,
        kinesthetic: 0,
    };

    document.querySelectorAll(".scale").forEach((scale) => {
        const checked = scale.querySelector("input:checked");
        if (!checked) return;

        const style = scale.dataset.style;
        totals[style] += Number(checked.value);
        counts[style] += 1;
    });

    return {
        visual: Number((totals.visual / counts.visual).toFixed(3)),
        auditory: Number((totals.auditory / counts.auditory).toFixed(3)),
        kinesthetic: Number((totals.kinesthetic / counts.kinesthetic).toFixed(3)),
    };
}

function setLoading(isLoading) {
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "Processing..." : "Predict Learning Style";
}

function renderResult(data) {
    const prediction = data.prediction || "Unknown";
    const scores = data.scores || collectScores();

    predictionTitle.textContent = prediction;
    predictionDescription.textContent = descriptions[prediction] || "The system successfully generated a prediction from the questionnaire scores sent to the API.";
    recommendationText.textContent = recommendations[prediction] || "Use a balanced mix of visual, auditory, and kinesthetic learning strategies based on the learning material.";

    scoreFields.visual.textContent = Number(scores.visual).toFixed(2);
    scoreFields.auditory.textContent = Number(scores.auditory).toFixed(2);
    scoreFields.kinesthetic.textContent = Number(scores.kinesthetic).toFixed(2);

    sourceBadge.textContent = data.source === "machine_learning_model" ? "ML Model" : "Fallback";
    sourceBadge.style.background = data.source === "machine_learning_model" ? "#2f9e44" : "#c47f18";

    const profileUrl = data.profile_pdf_url || `/profile-pdf/${prediction.toLowerCase()}`;
    profilePdfBtn.href = profileUrl;
    profilePdfBtn.download = `${prediction} Profile.pdf`;
    profilePdfBtn.textContent = `Download ${prediction} Profile PDF`;

    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusText.textContent = "";
    setLoading(true);

    try {
        const scores = collectScores();
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(scores),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "The API failed to process the prediction.");
        }

        renderResult(data);

        if (data.message) {
            statusText.textContent = data.message;
        } else {
            statusText.textContent = "Prediction generated successfully by the API.";
        }
    } catch (error) {
        statusText.textContent = `Error: ${error.message}`;
    } finally {
        setLoading(false);
    }
});

form.addEventListener("reset", () => {
    resultSection.classList.add("hidden");
    statusText.textContent = "";
});

downloadBtn.addEventListener("click", () => {
    const report = document.querySelector("#reportContent");
    const filename = `learning-style-report-${Date.now()}.pdf`;

    if (!window.html2pdf) {
        window.print();
        return;
    }

    const options = {
        margin: 10,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    window.html2pdf().set(options).from(report).save();
});
