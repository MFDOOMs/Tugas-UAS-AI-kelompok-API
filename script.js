const form = document.querySelector("#quizForm");
const resultSection = document.querySelector("#resultSection");
const predictionTitle = document.querySelector("#predictionTitle");
const predictionDescription = document.querySelector("#predictionDescription");
const recommendationText = document.querySelector("#recommendationText");
const sourceBadge = document.querySelector("#sourceBadge");
const statusText = document.querySelector("#statusText");
const profilePdfBtn = document.querySelector("#profilePdfBtn");
const confidenceValue = document.querySelector("#confidenceValue");
const confidenceNote = document.querySelector("#confidenceNote");
const strengthList = document.querySelector("#strengthList");
const watchoutList = document.querySelector("#watchoutList");
const activityList = document.querySelector("#activityList");

const scoreFields = {
    visual: document.querySelector("#visualScore"),
    auditory: document.querySelector("#auditoryScore"),
    kinesthetic: document.querySelector("#kinestheticScore"),
};

const scoreBars = {
    visual: document.querySelector("#visualBar"),
    auditory: document.querySelector("#auditoryBar"),
    kinesthetic: document.querySelector("#kinestheticBar"),
};

const probabilityFields = {
    Visual: document.querySelector("#visualProbability"),
    Auditory: document.querySelector("#auditoryProbability"),
    Kinesthetic: document.querySelector("#kinestheticProbability"),
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

const insightContent = {
    Visual: {
        strengths: [
            "Organizing information into clear written or visual structures.",
            "Remembering concepts through notes, diagrams, and visible patterns.",
            "Reviewing material independently through reading and summaries.",
        ],
        watchouts: [
            "Long verbal explanations without notes may feel harder to follow.",
            "Important details can be missed when information is only spoken once.",
            "Over-decorating notes can sometimes distract from the main concept.",
        ],
        activities: [
            "Create a one-page concept map after each topic.",
            "Use color-coded summaries for definitions, examples, and formulas.",
            "Convert lecture points into tables, timelines, or flowcharts.",
        ],
    },
    Auditory: {
        strengths: [
            "Processing information through explanation, discussion, and listening.",
            "Remembering ideas after hearing examples or verbal summaries.",
            "Clarifying concepts by talking them through with others.",
        ],
        watchouts: [
            "Silent reading sessions may need extra reinforcement.",
            "Noisy environments can reduce focus when listening is central.",
            "Relying only on lectures may make review less structured.",
        ],
        activities: [
            "Record short voice notes summarizing each lesson.",
            "Use peer discussion or teach-back sessions after studying.",
            "Read difficult material aloud and explain it in your own words.",
        ],
    },
    Kinesthetic: {
        strengths: [
            "Learning through direct practice, experiments, and real examples.",
            "Connecting abstract concepts to physical or practical experience.",
            "Staying engaged through active tasks and applied challenges.",
        ],
        watchouts: [
            "Long passive lectures may reduce attention and retention.",
            "Skipping written reflection can make practical learning harder to review.",
            "Hands-on work still needs clear theory checkpoints.",
        ],
        activities: [
            "Turn each concept into a small task, prototype, or case exercise.",
            "Use role-play, simulations, or lab-style practice when possible.",
            "Take active breaks and return with a concrete problem to solve.",
        ],
    },
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

function percentage(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return `${Math.round(value * 100)}%`;
}

function renderList(listElement, items) {
    listElement.innerHTML = "";
    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        listElement.appendChild(li);
    });
}

function renderResult(data) {
    const prediction = data.prediction || "Unknown";
    const scores = data.scores || collectScores();
    const probabilities = data.probabilities || {};
    const predictedProbability = probabilities[prediction];
    const insights = insightContent[prediction] || {
        strengths: ["Shows a balanced pattern across the questionnaire."],
        watchouts: ["Interpret the result as guidance rather than a fixed label."],
        activities: ["Combine visual, auditory, and kinesthetic learning strategies."],
    };

    predictionTitle.textContent = prediction;
    predictionDescription.textContent = descriptions[prediction] || "The system successfully generated a prediction from the questionnaire scores sent to the API.";
    recommendationText.textContent = recommendations[prediction] || "Use a balanced mix of visual, auditory, and kinesthetic learning strategies based on the learning material.";

    scoreFields.visual.textContent = Number(scores.visual).toFixed(2);
    scoreFields.auditory.textContent = Number(scores.auditory).toFixed(2);
    scoreFields.kinesthetic.textContent = Number(scores.kinesthetic).toFixed(2);

    scoreBars.visual.style.width = `${Math.min(Number(scores.visual) / 5 * 100, 100)}%`;
    scoreBars.auditory.style.width = `${Math.min(Number(scores.auditory) / 5 * 100, 100)}%`;
    scoreBars.kinesthetic.style.width = `${Math.min(Number(scores.kinesthetic) / 5 * 100, 100)}%`;

    probabilityFields.Visual.textContent = percentage(probabilities.Visual);
    probabilityFields.Auditory.textContent = percentage(probabilities.Auditory);
    probabilityFields.Kinesthetic.textContent = percentage(probabilities.Kinesthetic);

    confidenceValue.textContent = percentage(predictedProbability);
    confidenceNote.textContent = predictedProbability === undefined
        ? "This model response did not include probability values, so only the predicted class is shown."
        : `This value is the model probability for the predicted ${prediction} class.`;

    renderList(strengthList, insights.strengths);
    renderList(watchoutList, insights.watchouts);
    renderList(activityList, insights.activities);

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
