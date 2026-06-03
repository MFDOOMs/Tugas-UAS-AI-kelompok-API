const form = document.querySelector("#quizForm");
const resultSection = document.querySelector("#resultSection");
const predictionTitle = document.querySelector("#predictionTitle");
const predictionDescription = document.querySelector("#predictionDescription");
const recommendationText = document.querySelector("#recommendationText");
const sourceBadge = document.querySelector("#sourceBadge");
const statusText = document.querySelector("#statusText");
const downloadBtn = document.querySelector("#downloadBtn");

const scoreFields = {
    visual: document.querySelector("#visualScore"),
    auditory: document.querySelector("#auditoryScore"),
    kinesthetic: document.querySelector("#kinestheticScore"),
};

const apiUrl = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/predict"
    : `${window.location.origin}/predict`;

const scaleLabels = {
    1: "Tidak setuju",
    2: "Kurang",
    3: "Netral",
    4: "Setuju",
    5: "Sangat setuju",
};

const descriptions = {
    Visual: "Kamu cenderung lebih efektif memahami informasi lewat tampilan visual seperti diagram, peta konsep, warna, gambar, dan susunan catatan yang rapi.",
    Auditory: "Kamu cenderung lebih efektif memahami informasi lewat suara, diskusi, penjelasan lisan, dan proses menjelaskan ulang materi.",
    Kinesthetic: "Kamu cenderung lebih efektif memahami informasi lewat praktik langsung, simulasi, eksperimen, latihan, dan pengalaman nyata.",
};

const recommendations = {
    Visual: "Gunakan mind map, tabel ringkas, highlighter, diagram alur, dan rangkuman visual. Saat belajar, ubah materi panjang menjadi skema agar pola informasinya lebih mudah terlihat.",
    Auditory: "Belajar dengan diskusi, rekaman suara, membaca materi dengan lantang, atau menjelaskan ulang konsep kepada teman. Gunakan video pembelajaran yang memiliki narasi jelas.",
    Kinesthetic: "Perbanyak latihan soal, studi kasus, eksperimen kecil, role-play, dan simulasi. Pecah materi menjadi aktivitas singkat agar proses belajar terasa lebih konkret.",
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
    submitButton.textContent = isLoading ? "Memproses..." : "Prediksi Gaya Belajar";
}

function renderResult(data) {
    const prediction = data.prediction || "Tidak diketahui";
    const scores = data.scores || collectScores();

    predictionTitle.textContent = prediction;
    predictionDescription.textContent = descriptions[prediction] || "Sistem berhasil membuat prediksi berdasarkan skor kuesioner yang dikirim ke API.";
    recommendationText.textContent = recommendations[prediction] || "Gunakan kombinasi metode belajar visual, auditory, dan kinesthetic sesuai kebutuhan materi.";

    scoreFields.visual.textContent = Number(scores.visual).toFixed(2);
    scoreFields.auditory.textContent = Number(scores.auditory).toFixed(2);
    scoreFields.kinesthetic.textContent = Number(scores.kinesthetic).toFixed(2);

    sourceBadge.textContent = data.source === "machine_learning_model" ? "ML Model" : "Fallback";
    sourceBadge.style.background = data.source === "machine_learning_model" ? "#2f9e44" : "#c47f18";

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
            throw new Error(data.detail || "API gagal memproses prediksi.");
        }

        renderResult(data);

        if (data.message) {
            statusText.textContent = data.message;
        } else {
            statusText.textContent = "Prediksi berhasil dibuat oleh API.";
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
