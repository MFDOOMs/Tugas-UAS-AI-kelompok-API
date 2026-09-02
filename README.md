# AI-Based Learning Style Report

Sistem kuesioner VAK (Visual, Auditory, Kinesthetic) berbasis web yang memprediksi kecenderungan gaya belajar siswa menggunakan model Machine Learning, lalu menghasilkan laporan profil belajar yang dapat diunduh dalam bentuk PDF.

Proyek Tugas UAS Mata Kuliah Kecerdasan Buatan — Universitas Padjadjaran (UNPAD).

---

## Daftar Isi

- [Gambaran Umum](#gambaran-umum)
- [Fitur Utama](#fitur-utama)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Struktur Proyek](#struktur-proyek)
- [Dataset](#dataset)
- [Model dan Hasil Evaluasi](#model-dan-hasil-evaluasi)
- [Validation Layer](#validation-layer)
- [Instalasi](#instalasi)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Dokumentasi API](#dokumentasi-api)
- [Melatih Ulang Model](#melatih-ulang-model)
- [Catatan Teknis](#catatan-teknis)
- [Tim Pengembang](#tim-pengembang)

---

## Gambaran Umum

Pengguna mengisi 15 pernyataan kuesioner dengan skala Likert 1–5. Frontend menghitung rata-rata skor untuk tiap dimensi (Visual, Auditory, Kinesthetic), lalu mengirimkannya ke backend FastAPI. Backend menjalankan lapisan validasi terlebih dahulu, kemudian memanggil model Random Forest untuk menghasilkan prediksi gaya belajar beserta nilai probabilitasnya.

Hasil akhir yang ditampilkan ke pengguna:

- Label gaya belajar hasil prediksi (Visual / Auditory / Kinesthetic / Inconclusive)
- Skor VAK beserta visualisasi bar
- Confidence dan rincian probabilitas tiap kelas
- Rekomendasi belajar, kekuatan, hal yang perlu diwaspadai, dan saran aktivitas
- Tombol unduh PDF profil belajar sesuai hasil prediksi

## Fitur Utama

| Fitur | Keterangan |
|---|---|
| Kuesioner VAK 15 item | Skala 1–5, dirender otomatis oleh JavaScript |
| Prediksi Machine Learning | Random Forest (300 pohon) dengan 3 fitur agregat |
| Probability breakdown | Confidence per kelas dari `predict_proba` |
| Validation layer | Menolak memaksa klasifikasi ketika pola jawaban tidak wajar |
| Laporan PDF | Endpoint unduhan profil belajar per gaya belajar |
| Rule-based fallback | Sistem tetap berjalan meskipun file model tidak ditemukan |

## Arsitektur Sistem

Pendekatan yang digunakan adalah **supervised learning untuk klasifikasi data tabular**. Alur lengkapnya:

```
Kuesioner VAK (index.html)
        |
        v
Feature engineering (script.js)
  rata-rata visual, auditory, kinesthetic
        |
        v  POST /predict
Validation layer (main.py)
  deteksi straight-lining, variasi rendah, skor terlalu rapat
        |
        +--> anomali terdeteksi --> hasil "Inconclusive"
        |
        v
Random Forest (models/model_gaya_belajar.pkl)
        |
        v
Prediksi + probabilitas + konflik-check
        |
        v
Learning Profile PDF (profile_pdfs/)
```

**Alasan pemilihan arsitektur:** target prediksi sudah jelas berupa tiga kelas, sehingga supervised learning adalah pilihan yang tepat. Random Forest dipilih karena cocok untuk data tabular, mampu menangkap pola non-linear, stabil terhadap variasi data, mudah diekspor sebagai `.pkl`, dan mudah dijelaskan untuk kebutuhan akademik.

**Alasan tidak menggunakan alternatif lain:**

- **Rule-based** — terlalu kaku dan hanya menebak skor tertinggi. Pada dataset ini, aturan "skor tertinggi menang" hanya mencapai akurasi 81,4%, jauh di bawah Random Forest.
- **Deep learning** — terlalu kompleks untuk data tabular sederhana dan membutuhkan data jauh lebih besar.
- **KNN** — sensitif terhadap skala data dan pemilihan jumlah tetangga.
- **Naive Bayes** — asumsi independensi antarfitur terlalu kuat untuk skor VAK yang saling berkaitan.
- **SVM** — dapat digunakan, tetapi proses tuning dan interpretasinya lebih sulit dibanding Random Forest.

## Struktur Proyek

```
AI-Based-Learning-Style-Report/
├── main.py                            # Aplikasi FastAPI (endpoint, validasi, prediksi)
├── app.py                             # Entrypoint ASGI untuk deployment (from main import app)
├── index.html                         # Halaman kuesioner dan hasil
├── script.js                          # Render kuesioner, hitung skor VAK, panggil API
├── style.css                          # Styling antarmuka
├── requirements.txt                   # Dependensi runtime
├── Train_Model_Web_Compatible.ipynb   # Notebook pelatihan dan ekspor model
├── models/
│   ├── model_gaya_belajar.pkl         # Model Random Forest terlatih
│   └── model_metadata.json            # Metadata model dan label map
├── profile_pdfs/
│   ├── visual-profile.pdf
│   ├── auditory-profile.pdf
│   └── kinesthetic-profile.pdf
└── AI_Based_Learning_Style_Report_Summary.txt   # Ringkasan laporan proyek
```

## Dataset

Dataset yang digunakan adalah `SL_csv.csv`, yang diletakkan **satu folder di atas** direktori proyek (`../SL_csv.csv`). File ini tidak ikut di-commit ke repositori.

| Properti | Nilai |
|---|---|
| Jumlah baris | 1.210 |
| Jumlah kolom | 18 (`Gender`, `Age`, 15 item kuesioner, `Learner`) |
| Nilai kosong | Tidak ada |
| Baris duplikat | 295 (dihapus saat pelatihan) |
| Distribusi gender | Female 616, Male 594 |
| Rentang usia | 10–32 tahun (median 19) |
| Distribusi label | K: 679, A: 286, V: 245 |

### Pemetaan Item Kuesioner

15 item kuesioner terbagi menjadi tiga blok berisi lima pernyataan:

| Blok | Kolom | Tema Pernyataan |
|---|---|---|
| Visual | Q1–Q5 | Membaca papan tulis, membaca instruksi, membaca buku teks |
| Auditory | Q6–Q10 | Mendengarkan instruksi lisan, kuliah, penjelasan orang lain |
| Kinesthetic | Q11–Q15 | Praktik langsung, eksperimen, bermain peran |

### Catatan Penting soal Label

Pada dataset ini, huruf label **tidak sesuai dengan intuisi**. Berdasarkan rata-rata skor tiap blok pertanyaan per label:

| Learner | Rata-rata blok Visual | Rata-rata blok Auditory | Rata-rata blok Kinesthetic |
|---|---|---|---|
| A | **3,703** | 3,057 | 3,022 |
| K | 3,244 | 3,353 | **3,834** |
| V | 3,127 | **3,842** | 3,290 |

Seluruh 286 baris berlabel `A` memuncak pada blok **Visual**, dan seluruh 245 baris berlabel `V` memuncak pada blok **Auditory**. Maka pemetaan yang benar adalah:

```
A -> Visual
V -> Auditory
K -> Kinesthetic
```

Pemetaan inilah yang tersimpan di `models/model_metadata.json` dan dibaca oleh `main.py`, sehingga hasil prediksi yang ditampilkan ke pengguna sudah benar.

## Model dan Hasil Evaluasi

Model final: **Random Forest Classifier** (`n_estimators=300`, `class_weight="balanced"`, `random_state=42`).

| Metrik | Nilai |
|---|---|
| Test Accuracy | **97,18%** (172 dari 177 data uji) |
| Cross-Validation Accuracy (5-fold) | **95,17%** |
| Jumlah fitur | 3 (`visual`, `auditory`, `kinesthetic`) |
| Data setelah deduplikasi | 881 baris (705 train / 177 test) |

Laporan klasifikasi pada data uji:

| Kelas | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| A (Visual) | 0,98 | 0,98 | 0,98 | 49 |
| K (Kinesthetic) | 0,97 | 0,98 | 0,97 | 93 |
| V (Auditory) | 0,97 | 0,94 | 0,96 | 35 |
| **Accuracy** | | | **0,97** | **177** |

Feature importance relatif seimbang: visual 0,311 — auditory 0,371 — kinesthetic 0,318.

Akurasi digunakan sebagai metrik utama karena masalah yang diselesaikan adalah klasifikasi multi-kelas. Sebagai pembanding, baseline sederhana "ambil skor tertinggi" hanya menghasilkan akurasi 81,4% pada data uji yang sama, sehingga Random Forest memberikan peningkatan sekitar 16 poin — terutama pada kasus profil yang skornya berdekatan.

## Validation Layer

Sebelum prediksi diteruskan ke model, `main.py` memeriksa kewajaran pola jawaban. Jika salah satu kondisi berikut terpenuhi, sistem mengembalikan hasil `Inconclusive` dan **tidak** memaksakan klasifikasi:

| Pemeriksaan | Ambang batas |
|---|---|
| Semua item bernilai sama | Seluruh 15 jawaban identik |
| Straight-line answering | ≥ 12 item bernilai sama |
| Variasi jawaban terlalu rendah | Standar deviasi jawaban < 0,55 |
| Skor VAK terlalu rapat | Selisih skor tertinggi dan terendah < 0,35 |
| Konflik prediksi vs skor | Skor dominan melebihi skor kelas prediksi ≥ 0,8 |

Pemeriksaan terakhir dijalankan setelah model menghasilkan prediksi: jika model memilih kelas yang skor kuesionernya jauh lebih rendah dari skor dominan, hasil ditandai untuk ditinjau ulang, bukan diterbitkan sebagai profil final.

## Instalasi

**Prasyarat:** Python 3.12

```bash
# 1. Masuk ke direktori proyek
cd AI-Based-Learning-Style-Report

# 2. Buat dan aktifkan virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux / macOS

# 3. Pasang dependensi runtime
pip install -r requirements.txt
pip install uvicorn
```

`requirements.txt` hanya memuat dependensi minimum untuk runtime (`fastapi`, `joblib`, `scikit-learn`). Untuk menjalankan server secara lokal diperlukan `uvicorn`, dan untuk menjalankan notebook pelatihan diperlukan tambahan:

```bash
pip install pandas numpy jupyter
```

## Menjalankan Aplikasi

```bash
uvicorn main:app --reload --port 8000
```

Buka `http://127.0.0.1:8000` di browser. Server melayani `index.html` pada root, dan aset statis (`script.js`, `style.css`) melalui prefix `/static`.

Dokumentasi API interaktif tersedia otomatis di `http://127.0.0.1:8000/docs`.

Frontend juga dapat dibuka langsung dari file (`file://`) atau Live Server pada port 5500 — dalam mode ini `script.js` otomatis mengarahkan permintaan ke `http://127.0.0.1:8000/predict`. Origin tersebut sudah terdaftar pada konfigurasi CORS di `main.py`.

## Dokumentasi API

### `GET /`

Menyajikan halaman kuesioner (`index.html`).

### `POST /predict`

Menghasilkan prediksi gaya belajar dari skor VAK.

**Request body**

```json
{
  "visual": 4.33,
  "auditory": 2.67,
  "kinesthetic": 3.0,
  "answers": {
    "q1": 5, "q2": 4, "q3": 4, "q4": 4, "q5": 5,
    "q6": 3, "q7": 2, "q8": 3, "q9": 2, "q10": 3,
    "q11": 3, "q12": 3, "q13": 3, "q14": 3, "q15": 3
  }
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `visual` | float (1–5) | Ya | Rata-rata skor blok Visual |
| `auditory` | float (1–5) | Ya | Rata-rata skor blok Auditory |
| `kinesthetic` | float (1–5) | Ya | Rata-rata skor blok Kinesthetic |
| `answers` | object | Tidak | Jawaban mentah per item, dipakai validation layer |

**Response — prediksi berhasil**

```json
{
  "prediction": "Visual",
  "scores": { "visual": 4.33, "auditory": 2.67, "kinesthetic": 3.0 },
  "source": "machine_learning_model",
  "profile_pdf_url": "/profile-pdf/visual",
  "probabilities": { "Visual": 1.0, "Kinesthetic": 0.0, "Auditory": 0.0 }
}
```

**Response — pola jawaban tidak wajar**

```json
{
  "prediction": "Inconclusive",
  "scores": { "visual": 3.0, "auditory": 3.0, "kinesthetic": 3.0 },
  "source": "validation_layer",
  "profile_pdf_url": null,
  "anomalies": [
    "All questionnaire items received the same score, so the response pattern is not reliable enough for classification."
  ],
  "message": "The response pattern needs review before a reliable learning profile can be generated."
}
```

Nilai field `source` yang mungkin muncul:

| `source` | Arti |
|---|---|
| `machine_learning_model` | Prediksi berasal dari model Random Forest |
| `validation_layer` | Ditolak validasi, hasil `Inconclusive` |
| `rule_based_fallback` | File model tidak ditemukan, sistem memakai aturan skor tertinggi |

### `GET /profile-pdf/{learning_style}`

Mengunduh PDF profil belajar. Nilai `learning_style` yang valid: `visual`, `auditory`, `kinesthetic`. Mengembalikan `404` bila file PDF tidak tersedia.

## Melatih Ulang Model

Buka `Train_Model_Web_Compatible.ipynb` dan jalankan seluruh sel secara berurutan. Notebook akan:

1. Memuat `../SL_csv.csv` (atau `SL_csv.csv` di dalam folder proyek)
2. Mengubah nama 15 kolom pertanyaan menjadi `Q1`–`Q15`
3. Membersihkan data: hapus duplikat, buang label di luar `V`/`A`/`K`, buang NaN, filter skor 1–5
4. Membentuk fitur `visual`, `auditory`, `kinesthetic` dari rata-rata tiap blok
5. Membagi data 80/20 secara stratified dengan `random_state=42`
6. Membandingkan Logistic Regression dan Random Forest via 5-fold cross-validation
7. Mengekspor model terbaik ke `models/model_gaya_belajar.pkl` dan metadata ke `models/model_metadata.json`

`main.py` akan otomatis memuat file `.pkl` yang baru pada permintaan prediksi berikutnya.

## Catatan Teknis

Beberapa hal yang perlu diketahui saat mengembangkan proyek ini lebih lanjut:

- **Perbedaan label map antara notebook dan metadata.** Konstanta `LABEL_NAMES` di dalam notebook masih tertulis `{"V": "Visual", "A": "Auditory", "K": "Kinesthetic"}`, sedangkan `models/model_metadata.json` memakai `{"A": "Visual", "V": "Auditory", "K": "Kinesthetic"}`. Berdasarkan analisis dataset, **metadata yang benar**. Karena `main.py` membaca `label_map` dari metadata, keluaran API sudah tepat; yang perlu diperbaiki adalah cetakan label di notebook.
- **Skema metadata.** Sel ekspor pada notebook menulis kunci `target_labels`, sedangkan `main.py` membaca kunci `label_map`. File metadata yang ada sekarang sudah memakai `label_map`, sehingga sel ekspor notebook perlu disesuaikan agar hasil pelatihan ulang tetap kompatibel.
- **Kolom pertanyaan duplikat pada dataset.** Kolom ke-15 dan ke-16 pada `SL_csv.csv` memiliki teks pertanyaan yang identik ("I understand things better in class when I participate in role-playing."), namun nilainya berbeda pada 718 baris. Keduanya memang item yang berbeda, hanya saja penamaannya tertukar. Pada `index.html` teks item ke-15 sudah dibedakan.
- **Peringatan feature names.** Prediksi dari `main.py` dikirim sebagai list biasa, sementara model dilatih dengan DataFrame bernama kolom, sehingga scikit-learn memunculkan `UserWarning: X does not have valid feature names`. Peringatan ini tidak memengaruhi hasil prediksi.
- **Karakteristik dataset.** Kelas `A` dan `V` terpisah sempurna berdasarkan skor tertinggi, sedangkan `K` merupakan kelas mayoritas sekaligus kelas sisa yang paling ambigu. Akurasi tinggi pada model sebagian besar berasal dari kemudahan pemisahan ini, sehingga performa pada data di luar dataset perlu diuji kembali.

## Tim Pengembang

Universitas Padjadjaran (UNPAD)

| Nama | Peran |
|---|---|
| **Abraham Gomes Samosir** | Backend FastAPI, endpoint prediksi, integrasi model `.pkl`, endpoint PDF profil, dan validasi API |
| **Tristan Bonardo Silalahi** | Frontend HTML, CSS, dan JavaScript, tampilan kuesioner, kalkulasi skor VAK, tampilan hasil prediksi, serta pengalaman pengguna |
| **Newten Putra Santoso** | Pengelolaan dataset dan notebook pelatihan model, feature engineering, evaluasi performa model, serta integrasi hasil evaluasi ke dokumentasi |

Seluruh anggota turut berkontribusi dalam pengujian aplikasi, penyusunan laporan, penyempurnaan poster, dan validasi akhir sistem.
