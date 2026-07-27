from flask import Blueprint, request, session, jsonify
from user_manager import get_user_data, update_user_layer_data, update_user_dataset, get_unique_labels
from utils import load_json
from distinctipy import distinctipy
from matplotlib import colors as mcolors
import os
import json
import numpy as np
import traceback

data_routes = Blueprint('data_routes', __name__)

def generate_label_color_map(metadata, label_attr):
    """Generate color map from labels DataFrame. Returns list of {name, count, color} dicts.
    Colors are deterministically assigned based on sorted label names."""
    
    counts = metadata[label_attr].value_counts()
    
    category_count = [{'name': category, 'count': count} for category, count in counts.items()]

    unique_labels = sorted(metadata[label_attr].unique(), key=lambda label: str(label))
    
    if len(unique_labels) > 20:
        colors = distinctipy.get_colors(len(unique_labels), rng=50)
        hex_colors = [mcolors.to_hex(c) for c in colors]
    else:
        hex_colors = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
            '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
            '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
        ]
    
    label_to_color = {
        label: hex_colors[idx]
        for idx, label in enumerate(unique_labels)
    }
    return [
        {**obj, 'color': label_to_color[obj['name']]}
        for obj in category_count
    ]

# get the legend information)
@data_routes.route('/legend_info', methods=('GET', 'POST'))
def get_legend_info():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances.get('metadata_master')
    
    category_attr = user_instances.get('CATEGORY_ATTRIBUTE', 'label')
    label_color_cont_map = generate_label_color_map(metadata, category_attr)
    for label_color_cont in label_color_cont_map:
        label_color_cont['selectedNum'] = 0
    return label_color_cont_map

# get dataset info (e.g., to conditionally change UI labels)
@data_routes.route('/dataset_info', methods=('GET', 'POST'))
def get_dataset_info():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    dataset_name = user_instances.get('DATASET_NAME')
    return {"DATASET_NAME": dataset_name}

# get POS tag descriptions when dataset is GMB
@data_routes.route('/pos_tags_info', methods=('GET', 'POST'))
def get_pos_tags_info():
    try:
        user_id = session['user_id']
        user_instances = get_user_data(user_id)
        if user_instances.get('DATASET_NAME') != 'gmb_data':
            return {}
        # Resolve path: backend/data/gmb_data/pos_tags.json
        current_dir = os.path.dirname(os.path.abspath(__file__))
        pos_path = os.path.abspath(os.path.join(current_dir, '..', 'data', 'gmb_data', 'pos_tags.json'))
        with open(pos_path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

# get the total number of layers
@data_routes.route('/get_total_layers', methods=('GET', 'POST'))
def get_total_layers():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    total_layers = user_instances.get('total_layers')
    return {"total_layers": int(total_layers) if total_layers is not None else 12}

@data_routes.route('/datasets', methods=('GET',))
def get_datasets():
    cfg = load_json('config.json')
    keys = [k for k in cfg.keys() if k not in ['default']]
    # Get current dataset from user session
    current_dataset = None
    try:
        user_id = session.get('user_id')
        if user_id:
            user_instances = get_user_data(user_id)
            current_dataset = user_instances.get('DATASET_NAME_key')
    except Exception:
        pass
    return {
        "datasets": keys, 
        "default": cfg.get('default'),
        "current": current_dataset or cfg.get('default')  # Return current dataset from session
    }

@data_routes.route('/update_dataset', methods=('POST',))
def update_dataset():
    user_id = session['user_id']
    payload = request.get_json() or {}
    dataset_key = payload.get('dataset_key')
    if not dataset_key:
        return {"status": "error", "message": "dataset_key required"}, 400
    update_user_dataset(user_id, dataset_key)
    # After switching dataset, you may want to reset to default layer (handled in frontend) or here
    return {"status": "success", "dataset": dataset_key}

@data_routes.route('/update_data', methods=('GET', 'POST'))
def update_data():
    """Update mapper and projection data when model or layer changes."""
    print('update_data')
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    DATASET_NAME_key = user_instances['DATASET_NAME_key']
    print('the DATASET_NAME_key is', DATASET_NAME_key)
     
    response_data = request.get_json()
    timestamp = response_data.get('name')  # Timestamp
    layer_name = response_data.get('layer')  # Layer name
    update_user_layer_data(user_id, int(layer_name))  # Set the layer number
    print('set_layer_num', layer_name, timestamp, 'for user:', user_id)
    
    # Use user-specific instances instead of global ones
    raw_data = user_instances['raw_data']
    mapper_graph = user_instances['mapper_graph']
    projection = user_instances['projection']
    classical_mapper_obj = user_instances['classical_mapper_obj']
    activations = user_instances['embeds']
    metadata = user_instances['metadata']
    
    # Get unique labels dynamically from metadata using CATEGORY_ATTRIBUTE
    unique_labels = get_unique_labels(user_instances)
    
    # Activations were normalized and loaded into raw_data by update_user_layer_data.
    
    # Get mapper parameters from config (default values if not set)
    mapper_params = user_instances.get('mapper_params', {})
    cover_strategy = mapper_params.get('cover_strategy', 'uniform')
    cover_val = mapper_params.get('cover_num', 50)
    overlap_val = mapper_params.get('overlap_pct', 0.5)
    minPts_val = mapper_params.get('minPts_val', 3)
    
    graph_data, eps_val = classical_mapper_obj.create_mapper(
        raw_data, eps_val=0, minPts_val=minPts_val, cover_val=cover_val, overlap_val=overlap_val,
        label_df=metadata, unique_label_list=unique_labels, cover_strategy=cover_strategy, 
        use_elbow_way= user_instances['DATASET_NAME'] == 'topobert_data'  # use the elbow way for topoBERT dataset, GMB dataset use the percentile way
    )
    print('graph_data loaded for user:', user_id)
    mapper_graph.load_graph(graph_data, eps_val)
    projection.load_data(raw_data)

    # Return L2 norm range
    return {"max_L2": 1, "min_L2": 0}

# get the projection plot position according to dimension reduction method
@data_routes.route('/projection_data', methods=('GET', 'POST'))
def get_projection_data():
    print('get_projection_data')
    try:
        user_id = session['user_id']
        user_instances = get_user_data(user_id)
        metadata = user_instances['metadata']
        projection = user_instances['projection']
        raw_data = user_instances['raw_data']

        # Ensure projection processor has the current activations (e.g. after session recreate).
        if projection.data is None and raw_data is not None:
            projection.load_data(raw_data)

        request_data = request.get_json() or {}
        DM = request_data.get('DM')
        if not DM:
            return jsonify({"error": "DM (dimensionality reduction method) is required"}), 400

        unique_labels = get_unique_labels(user_instances)
        print(f'computing projection with method={DM}')
        result = projection.get_projection_res(DM, metadata, unique_labels)
        print(f'projection ready method={DM} points={len(result)}')
        return jsonify(result)
    except Exception as error:
        print(f'projection_data failed: {error}')
        traceback.print_exc()
        return jsonify({"error": str(error)}), 500

# get the mapper graph layout and eps_val
# {'graph_data': self.graph_data, 'eps_val': self.eps_val}
@data_routes.route('/mapper_data', methods=('GET', 'POST'))
def get_mapper_data():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    projection = user_instances['projection']
    
    response_data = request.get_json()
    layout = response_data.get('layout') 
    return mapper_graph.get_mapper_data(layout, projection)

@data_routes.route('/mapper_parameters', methods=('GET', 'POST'))
def get_mapper_parameters():
    """Get the current mapper parameters from config for the active dataset."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    
    # Get mapper parameters from user_instances (set when dataset is loaded)
    mapper_params = user_instances.get('mapper_params', {})
    
    return {
        'minPts_val': mapper_params.get('minPts_val', 3),
        'cover_num': mapper_params.get('cover_num', 50),
        'overlap_pct': mapper_params.get('overlap_pct', 0.5),
        'cover_strategy': mapper_params.get('cover_strategy', 'uniform')
    }

# update the selectedNum attr for each category using selectedInstances
# [{'name': category, 'count': , 'color': , 'selectedNum':}, ...]
@data_routes.route('/update_legend_info', methods=('GET', 'POST'))
def update_legend_info():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata_master']
    label_attr = user_instances['CATEGORY_ATTRIBUTE']
    response_data = request.get_json() 
    selectedInstances = response_data.get('selectedInstances')  
    selected_ids = selectedInstances['instances']
    
    # Get color map for current dataset
    label_color_cont_map_dynamic = generate_label_color_map(metadata, label_attr)

    if len(selected_ids) == 0:
        for label_color_cont in label_color_cont_map_dynamic:
            label_color_cont['selectedNum'] = 0
    else:
        filtered_df = metadata[metadata.index.isin(selected_ids)]
        category_counts = filtered_df[label_attr].value_counts().to_dict()
        for label_color_cont in label_color_cont_map_dynamic:
            category_name = label_color_cont['name']
            if category_name in category_counts:
                label_color_cont['selectedNum'] = category_counts[category_name]
            else:
                label_color_cont['selectedNum'] = 0 
    return label_color_cont_map_dynamic
