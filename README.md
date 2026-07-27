# Explainable Mapper

Interactive visualization system for exploring contextualized word embeddings with the **Mapper** algorithm, linked projections, LLM-based explanations, and perturbation trajectory generation.

This repository is a full-stack application:


| Folder      | Role                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| `frontend/` | React user interface (Create React App)                                                 |
| `backend/`  | Flask API: dataset loading, Mapper computation, projections, explanations, trajectories |
| `docs/`     | Extra documentation, requirements, and demo media                                       |


Multi-user browsing is supported with Flask sessions: each browser client gets a session cookie and isolated in-memory state (`backend/user_manager.py`).

---

## OpenAI API key (required — bring your own)

**This repository does not include an OpenAI API key.** No secret keys are shipped in the public release.

You must provide **your own** OpenAI API key before using LLM features (explanations, trajectory generation, highlight-changes):

1. Create a key in your [OpenAI account](https://platform.openai.com/api-keys).
2. In `backend/`, copy the example env file and edit it locally:

```bash
cd backend
cp .env.example .env
```

1. Set your key in `backend/.env` (this file is gitignored and must never be committed):

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

1. Restart the Flask backend so the new key is loaded.

Without a valid key, Mapper / projection browsing can still work, but generative explanation and trajectory features will fail.

> **Security:** Keep `backend/.env` private. Only `backend/.env.example` (with a placeholder value) belongs in the repository.

---

## Demo video

An interaction demo walks through the main UI workflows (selection, explanation, trajectories, and linked views):

**[Watch the interaction demo on YouTube](https://youtu.be/VrMM4xdlLjM)**

---

## Features (overview)

- Mapper graph construction and interaction (nodes, edges, paths, components)
- Linked 2D projection views (e.g., PCA / UMAP)
- Category legend filtering and selection highlighting
- LLM-assisted node / component explanations and keyword summaries
- Perturbation trajectory generation, edit highlighting, and attach-to-mapper/projection

---

## Requirements

See **[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)** for system, software, dataset, and API-key requirements.

**Quick summary**

- Python **3.10+** (3.11 recommended)
- Node.js **18+** and npm
- **Your own OpenAI API key** (not included; see [OpenAI API key](#openai-api-key-required--bring-your-own))
- TopoBERT release data package (hosted separately; see Dataset below)

Python packages are pinned in `[backend/requirements.txt](backend/requirements.txt)`.  
Frontend packages are listed in `[frontend/package.json](frontend/package.json)`.

---

## Dataset (TopoBERT)

This project is configured by default for the **TopoBERT** fine-tuned BERT-Base setting (`topobert_data_bertbase` in `backend/config.json`).

The dataset is **hosted separately** (not included in this Git repository).

1. Download the demo data from:  
   **[ExplainableMapper-DemoData (Google Drive)](https://drive.google.com/drive/folders/1vYKgkAS7lAyGFaUNAX72AkKwVjXXOVr2?usp=sharing)**
2. Unzip the archive (if needed).
3. Place the extracted contents so that the following path exists:

```text
backend/data/topobert_data/
```

Expected layout for the default configuration (`ss-role` + `FT_BertBase`):

```text
backend/data/topobert_data/ss-role/
├── sentences/train.json
├── entities/train.txt
├── FT_BertBase/
│   ├── embedding/train/413/          # layer embeddings
│   ├── explanations/                 # precomputed node/component explanations (optional but recommended)
│   └── models/checkpoint-413/        # model checkpoint used for embedding / perturbation
└── perturbation_data_4o/
    ├── FT_BertBase_embeds/
    └── metadata.pkl
```

Exact paths are defined in `backend/config.json` under `PATHS`. After unpacking, confirm those files resolve relative to the `backend/` working directory.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/tdavislab/Explainable-Mapper.git
cd Explainable-Mapper
```

### 2. Download and place the dataset

Follow the [Dataset](#dataset-topobert) section above so `backend/data/topobert_data/` is populated.

### 3. Backend environment

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Provide your own OpenAI API key** (none is included in this repo):

```bash
cp .env.example .env
```

Edit `backend/.env` and replace the placeholder with **your** key:

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

Do not commit `.env`. Optional production settings:

```bash
export FLASK_SECRET_KEY='replace-with-a-long-random-string'
export FLASK_DEBUG=0
```

### 4. Frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the full system

Start **both** processes (two terminals).

### Terminal A — Backend (Flask, port 5005)

```bash
cd backend
source venv/bin/activate          # if not already active
python app.py
```

The API listens on `http://127.0.0.1:5005`.

### Terminal B — Frontend (React, port 3000)

```bash
cd frontend
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome (recommended).  
The frontend proxies `/api/`* requests to the Flask server via `frontend/src/setupProxy.js`.

---

## Configuration notes

- Default dataset key: `topobert_data_bertbase` in `backend/config.json`
- Mapper defaults (cover size, overlap, etc.) live under each dataset entry’s `MapperParameters`
- LLM features require **your own** `OPENAI_API_KEY` in `backend/.env` (see above); no key is distributed with the code
- Without a key, core Mapper / projection browsing may still work, but generative explanation and trajectory features will fail

---

## Using your own data

The system is designed around **focus-word instances**: each row is one sentence with a marked focus word, a category label, and a matching embedding vector.

> **Coming soon:** We plan to release a more accessible data-processing workflow so users can prepare custom datasets more easily. Until then, please prepare the files below yourself and wire them into the app as described here.

### What to prepare

Place your files under `backend/data/` (recommended layout):

```text
backend/data/<DATASET_NAME>/<NAME>/
├── sentences.json
├── metadata.pkl
├── <MODEL_NAME>_embeds/{1..L}.txt
├── perturbation_data_4o/
│   ├── metadata.pkl
│   └── <MODEL_NAME>_embeds/{1..L}.txt
└── <MODEL_NAME>_explanations/          # optional
    ├── nodes_explanation_layer{L}.json
    └── components_explanation_layer{L}.json
```


| File                                   | Required?             | Format / expectations                                                                                         |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sentences.json`                       | Yes                   | `{ "0": ["token", "list", ...], "1": [...], ... }` — sentence ID → token list                                 |
| `metadata.pkl`                         | Yes                   | pandas DataFrame with at least `word`, `sent_id`, `word_id`, `label`                                          |
| `<MODEL_NAME>_embeds/{layer}.txt`      | Yes                   | One whitespace-separated float matrix per layer; shape **N × D**, where row *i* matches metadata row *i*      |
| `perturbation_data_4o/metadata.pkl`    | Yes (current runtime) | DataFrame with `id`, `p_id`, `v_id`, `perturbed_sentence` — **exactly 5** perturbations per original instance |
| `perturbation_data_4o/.../{layer}.txt` | Yes (current runtime) | Shape **(N × 5) × D**, aligned as blocks of 5 rows per original instance                                      |
| Explanation JSONs                      | Optional              | Cached node/component summaries; missing files are OK (live LLM can still generate if you set an API key)     |
| Model checkpoint                       | Optional              | Useful for trajectory attach / on-the-fly embeddings; otherwise a public model id may be used as fallback     |


### Important conventions

- `**word_id` in `metadata.pkl`:** 0-based index into that sentence’s token list (the loader converts it to the app’s 1-based convention).
- `**label`:** Category column must be named `label` (used by the Mapper legend and node composition).
- **Perturbed sentences:** Mark the focus word with brackets, e.g. `We waited [until] morning.`
- **Row alignment:** Main embeds, metadata, and perturbation blocks must stay aligned (`i` ↔ `i` ↔ rows `i*5 … i*5+4`).
- **Layers:** Provide embedding files for every layer the UI can select (configured via `LAYER_NUM`).

### Wire your dataset into the app

1. Add a new entry in `backend/config.json` (copy an existing GMB-style entry such as `gmb_data_cia` as a template). Set `DATASET_NAME`, `NAME`, `MODEL_NAME`, `LAYER_NUM`, `CATEGORY_ATTRIBUTE`, `MapperParameters`, and `PATHS` so they point at your files.
2. Register your dataset key in `backend/user_manager.py` under `_DATASET_LOADERS` (use the same loader as the GMB-style datasets).
3. Point the frontend at your key in `frontend/src/components/Title.js` (the UI is currently fixed to the default TopoBERT BERT-Base dataset).

After that, restart the backend and frontend and load your data like the default dataset.

---

## Citation / acknowledgment

If you use this software or the TopoBERT-related materials in research, please cite the corresponding papers / dataset releases (add citation entries here before public announcement).