# System & Software Requirements

This document describes what you need to install and configure before running **Explainable Mapper** (frontend + backend).

For step-by-step setup and run instructions, see the root [`README.md`](../README.md).

---

## 1. Hardware (recommended)

| Resource | Recommendation |
|----------|----------------|
| CPU | Modern multi-core CPU |
| RAM | **16 GB+** recommended (embeddings + Mapper + optional UMAP) |
| Disk | Enough space for the TopoBERT data package (often several GB) |
| GPU | Optional; embedding / PyTorch paths may use GPU if available, but CPU is sufficient for exploration |

---

## 2. Operating system

- macOS, Linux, or Windows (WSL2 recommended on Windows for Python tooling)
- Google Chrome recommended for the UI

---

## 3. Software prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.10+ (3.11 recommended) | Flask backend |
| Node.js | 18+ LTS | React frontend |
| npm | Comes with Node.js | Frontend package install |
| Git | Any recent version | Clone the repository |

Optional but useful:

- A browser, if you want to watch the [interaction demo on YouTube](https://youtu.be/VrMM4xdlLjM)

---

## 4. Python dependencies (backend)

Install from the pinned lock-style list:

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Major backend libraries include:

- **Web:** Flask, Flask-Session
- **Data / ML:** NumPy, SciPy, pandas, scikit-learn, PyTorch, transformers, sentence-transformers
- **Topology / viz helpers:** KeplerMapper (`kmapper`), umap-learn, NetworkX
- **LLM:** openai
- **Config:** python-dotenv

The authoritative version pins are in [`backend/requirements.txt`](../backend/requirements.txt).

> **Note:** The root [`requirements.txt`](../requirements.txt) only points to the backend file and is not a second dependency set.

---

## 5. Node dependencies (frontend)

```bash
cd frontend
npm install
```

Major frontend libraries include:

- React 18
- MUI (Material UI / Joy)
- D3, Cytoscape (+ BubbleSets)
- Axios, Zustand, TanStack Table
- Chart.js / react-chartjs-2

See [`frontend/package.json`](../frontend/package.json).

---

## 6. External services & secrets

**No API keys are included in this repository.** Each user must supply their own.

| Requirement | Required for | How to configure |
|-------------|--------------|------------------|
| OpenAI API key (**bring your own**) | LLM explanations, trajectory generation, highlight-changes | Copy `backend/.env.example` → `backend/.env`, then set `OPENAI_API_KEY` to your key |
| Flask secret key | Secure sessions in deployment | `FLASK_SECRET_KEY` environment variable |

Never commit real `.env` files or API keys. Only the placeholder file `.env.example` should be in Git.

---

## 7. Dataset requirements

| Item | Details |
|------|---------|
| Dataset | TopoBERT package used by default as `topobert_data_bertbase` |
| Hosting | Separate from this Git repo |
| Download | [Google Drive demo data](https://drive.google.com/drive/folders/1vYKgkAS7lAyGFaUNAX72AkKwVjXXOVr2?usp=sharing) |
| Install path | `backend/data/topobert_data/` (see README for folder layout) |
| Config | `backend/config.json` |

Without the dataset in place, Mapper construction and related APIs will fail.

---

## 8. Network ports

| Service | Default port |
|---------|----------------|
| React frontend | `3000` |
| Flask backend | `5005` |

The frontend development server proxies `/api` → `http://127.0.0.1:5005`.

---

## 9. Demo media

| Resource | Purpose |
|----------|---------|
| [YouTube demo](https://youtu.be/VrMM4xdlLjM) | Screen recording of system interaction |

See [`DEMO.md`](DEMO.md).
