"""
Legacy module-level dataset defaults.

Per-user dataset/layer state lives in `user_manager` (keyed by Flask session
`user_id`). Prefer reading from `get_user_data(user_id)` in route handlers.
This module only exposes the configured default dataset key for tooling that
still needs a process-level fallback.
"""
from utils import load_json

try:
    _cfg = load_json('config.json')
    DEFAULT_DATASET_KEY = _cfg.get('default', 'gmb_data_cia_modernBERT')
    DATASET_NAME = _cfg.get(DEFAULT_DATASET_KEY, {}).get('DATASET_NAME')
except Exception:
    DEFAULT_DATASET_KEY = 'gmb_data_cia_modernBERT'
    DATASET_NAME = 'gmb_data'
