import threading
import time
from datetime import datetime, timedelta
from models.graph import GraphAnalysis
from models.rawData import RawDataProcesser
from models.projection import ProjectionProcessor
from models.mapper import ClassicalMapper
import numpy as np
import copy
import os
from utils import load_json, process_topobert_metadata, load_pickle

# ----Store user-specific data----
user_data = {} # key: user_id, value: user_data
user_data_lock = threading.RLock()  # Reentrant lock instead of regular Lock
session_activity = {} # record the last time the user interacted with the server
# ----Store user-specific data----

def _build_path(path_template: str, **kwargs) -> str:
    """Build a path from template with validation."""
    try:
        return path_template.format(**kwargs)
    except KeyError as e:
        raise ValueError(f"Missing required path parameter: {e}") from e

def get_user_data(user_id):
    """Get or create user-specific data"""
    with user_data_lock:
        if user_id not in user_data:
            # Create fresh instances for this user
            user_instances = {
                'raw_data': RawDataProcesser(),
                'projection': ProjectionProcessor(),
                'classical_mapper_obj': ClassicalMapper(),
                'perturb_embeds': None, # perturbation embeddings at current layer
                'embeds': None, # embeddings at current layer
                'current_layer': None,
                'metadata': None,
                'perturb_metadata': None,
                'node_explanations': None, # layer-specific node explanations
                'component_explanations': None, # layer-specific component explanations
                # dataset-scoped config
                'DATASET_NAME_key': None,
                'DATASET_NAME': None,
                'NAME': None,
                'MODEL_NAME': None,
                'PATHS': None,
                'embeds_base_path': None,
                'perturb_embeds_path': None,
                'total_layers': None,
                'CATEGORY_ATTRIBUTE': None,  # e.g., 'label' or 'pos_tag'
                # master copies (unfiltered) for current dataset
                'metadata_master': None,
                'perturb_metadata_master': None,
                # transient, per-user payload for legacy perturbation upload endpoints
                'perturb_data': None,
            }
            user_instances['mapper_graph'] = GraphAnalysis(user_instances['raw_data'])
            user_data[user_id] = user_instances
            print(f"Created new user session: {user_id}")
            # Initialize dataset and layer (default: use current config default key)
            try:
                default_key = load_json('config.json')['default']
            except Exception:
                # fallback to a known key
                default_key = 'gmb_data_cia_modernBERT'
            update_user_dataset(user_id, default_key)
            update_user_layer_data(user_id, 12) # default layer
        return user_data[user_id]


def update_user_layer_data(user_id, layer_num):
    """Update user-specific perturbation data for the given layer"""
    with user_data_lock: 
        if user_id not in user_data:
            return
        user_instances = user_data[user_id]
        # Only reload if layer has changed
        if user_instances['current_layer'] == layer_num:
            return
        
        # load the embeddings at current layer (from per-user dataset paths)
        word_embeds = np.loadtxt(os.path.join(user_instances['embeds_base_path'], f'{layer_num}.txt'))
        layer_path = os.path.join(user_instances['perturb_embeds_path'], f'{layer_num}.txt')
        perturb_embeds = np.loadtxt(layer_path)
        metadata_copy = copy.deepcopy(user_instances['metadata_master'])
        perturb_metadata_copy = copy.deepcopy(user_instances['perturb_metadata_master'])

        # Normalize activations once, then reuse the same center/scale for perturbations.
        user_instances['raw_data'].load_activation_data(word_embeds)
        word_embeds = user_instances['raw_data'].get_original_activation_data()
        perturb_embeds = user_instances['raw_data'].transform_embeddings(perturb_embeds)

        # Load layer-specific explanation data
        path_vars = {
            'DATASET_NAME': user_instances['DATASET_NAME'],
            'NAME': user_instances['NAME'],
            'MODEL_NAME': user_instances['MODEL_NAME'],
            'LAYER_NUM': layer_num
        }
        node_explanation_path = _build_path(user_instances['PATHS']["NODE_EXPLANATION_PATH"], **path_vars)       
        component_explanation_path = _build_path(user_instances['PATHS']["COMPONENT_EXPLANATION_PATH"], **path_vars)
        try:
            user_instances['node_explanations'] = load_json(node_explanation_path)
            user_instances['component_explanations'] = load_json(component_explanation_path)
        except FileNotFoundError:
            print(f"Warning: Explanation files not found for layer {layer_num}")
            user_instances['node_explanations'] = {}
            user_instances['component_explanations'] = {}
        
        # update the user_instances
        user_instances['embeds'] = word_embeds
        user_instances['perturb_embeds'] = perturb_embeds
        user_instances['current_layer'] = layer_num
        user_instances['metadata'] = metadata_copy  
        user_instances['perturb_metadata'] = perturb_metadata_copy 

        print(f"Updated data for user {user_id}, layer {layer_num}")


def _load_topobert_data(user_instances: dict, paths: dict, 
                       dataset_name: str, name: str) -> None:
    """Load TopoBERT dataset labels and metadata."""
    metadata_path = _build_path(paths["METADATA_PATH"], DATASET_NAME=dataset_name, NAME=name)
    sentences_path = _build_path(paths["SENTENCES_PATH"], DATASET_NAME=dataset_name, NAME=name)
    perturb_meta_path = _build_path(paths["PERTURB_META_PATH"], DATASET_NAME=dataset_name, NAME=name)

    try:
        user_instances['metadata_master'] = process_topobert_metadata(metadata_path, sentences_path, name)
    except ValueError as e:
        # If the function doesn't support this dataset variant, we need to handle it
        raise NotImplementedError(f"TopoBERT dataset variant '{name}' not yet supported: {e}") from e
    user_instances['perturb_metadata_master'] = load_pickle(perturb_meta_path)  

def _load_gmb_data(user_instances: dict, paths: dict,
                  dataset_name: str, name: str) -> None:
    """Load GMB dataset labels and metadata."""
    metadata_path = _build_path(paths["METADATA_PATH"], DATASET_NAME=dataset_name, NAME=name)
    sentences_path = _build_path(paths["SENTENCES_PATH"], DATASET_NAME=dataset_name, NAME=name)
    perturb_meta_path = _build_path(paths["PERTURB_META_PATH"], DATASET_NAME=dataset_name, NAME=name)
    
    user_instances['perturb_metadata_master'] = load_pickle(perturb_meta_path)
    
    metadata_df = load_pickle(metadata_path)
    metadata_df['word_id'] = metadata_df['word_id'] + 1
    metadata_df['idx'] = range(len(metadata_df))
    
    sent_data = load_json(sentences_path)
    metadata_df['sentence'] = metadata_df['sent_id'].apply(lambda x: ' '.join(sent_data[str(x)]))
    user_instances['metadata_master'] = metadata_df

# Dataset loader registry
_DATASET_LOADERS = {
    'gmb_data_cia_modernBERT': _load_gmb_data,
    'gmb_data_cia': _load_gmb_data,
    'gmb_data_basicjokes': _load_gmb_data,
    'topobert_data_bertbase': _load_topobert_data,
    'topobert_data_roberta': _load_topobert_data,
}

def update_user_dataset(user_id: str, dataset_key: str) -> None:
    """Switch the current dataset for a user and (re)load dataset-scoped resources.
    
    Args:
        user_id: Unique identifier for the user session
        dataset_key: Key identifying the dataset in config.json
    """
    with user_data_lock:
        if user_id not in user_data:
            raise ValueError(f"User {user_id} not found")
        
        # Load and validate config
        try:
            cfg_all = load_json('config.json')
        except Exception as e:
            raise RuntimeError(f"Failed to load config.json: {e}") from e
        
        if dataset_key not in cfg_all:
            raise KeyError(f"Dataset key '{dataset_key}' not found in config.json")
        
        cfg = cfg_all[dataset_key]
        
        # Validate required config fields
        required_fields = ['DATASET_NAME', 'NAME', 'MODEL_NAME', 'LAYER_NUM', 'PATHS', 'CATEGORY_ATTRIBUTE']
        missing = [f for f in required_fields if f not in cfg]
        if missing:
            raise ValueError(f"Config missing required fields: {missing}")

        user_instances = user_data[user_id]
        
        # Update dataset-scoped identifiers
        user_instances['DATASET_NAME_key'] = dataset_key
        user_instances['DATASET_NAME'] = cfg['DATASET_NAME']
        user_instances['NAME'] = cfg['NAME']
        user_instances['MODEL_NAME'] = cfg['MODEL_NAME']
        user_instances['PATHS'] = cfg['PATHS']
        user_instances['total_layers'] = cfg['LAYER_NUM']
        user_instances['CATEGORY_ATTRIBUTE'] = cfg['CATEGORY_ATTRIBUTE']
        
        # Store mapper parameters from config (with defaults if not present)
        mapper_params = cfg.get('MapperParameters', {})
        user_instances['mapper_params'] = {
            'cover_num': mapper_params.get('cover_num', 50),
            'overlap_pct': mapper_params.get('overlap_pct', 0.5),
            'minPts_val': mapper_params.get('minPts_val', 3),
            'cover_strategy': mapper_params.get('cover_strategy', 'uniform')
        }

        # Build resolved paths
        paths = cfg['PATHS']
        path_vars = {
            'DATASET_NAME': cfg['DATASET_NAME'],
            'NAME': cfg['NAME'],
            'MODEL_NAME': cfg['MODEL_NAME']
        }
        
        user_instances['embeds_base_path'] = _build_path(
            paths["EMBEDS_BASE_PATH"], **path_vars
        )
        user_instances['perturb_embeds_path'] = _build_path(
            paths["PERTURB_EMBEDS_PATH"], **path_vars
        )

        # Load dataset-specific data using registry for metadata and perturb_metadata
        loader = _DATASET_LOADERS.get(dataset_key)
        if loader is None:
            raise NotImplementedError(f"Dataset loader not implemented for key: {dataset_key}")
        try:
            loader(user_instances, paths, dataset_name=cfg['DATASET_NAME'], name=cfg['NAME'])
        except FileNotFoundError as e:
            raise FileNotFoundError(f"Required data file not found for dataset {dataset_key}: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Failed to load dataset {dataset_key}: {e}") from e

        # Reset current layer so next update_layer will run
        user_instances['current_layer'] = None
        print(f"Updated dataset for user {user_id} -> {dataset_key}")

def get_unique_labels(user_instances: dict) -> list:
    """Get unique labels/categories from metadata_master using CATEGORY_ATTRIBUTE.
    
    Args:
        user_instances: User data dictionary
        
    Returns:
        Sorted list of unique category values
    """
    metadata = user_instances.get('metadata')
    category_attr = user_instances.get('CATEGORY_ATTRIBUTE')
    unique_labels = sorted(metadata[category_attr].unique().tolist())
    return unique_labels

# ----session management----
def cleanup_old_sessions():
    """Remove sessions older than 2 hours"""
    cutoff = datetime.now() - timedelta(hours=2)
    with user_data_lock:
        for user_id in list(user_data.keys()):
            if user_id in session_activity:
                if session_activity[user_id] < cutoff:
                    del user_data[user_id]
                    del session_activity[user_id]
                    print(f"Cleaned up old session: {user_id}")

def periodic_cleanup():
    """Run cleanup every 30 minutes"""
    while True:
        time.sleep(1800)  # 30 minutes
        cleanup_old_sessions()

def update_session_activity(user_id):
    """Update session activity timestamp"""
    with user_data_lock:
        session_activity[user_id] = datetime.now()

# Start cleanup thread
cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
cleanup_thread.start() 
# ----session management----