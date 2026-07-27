import os
from statistics import quantiles
import numpy as np
from flask import Blueprint, request, jsonify, session
from utils import elbow_eps_raw
from models.mapper import create_ball_mapper
from user_manager import get_user_data, get_unique_labels


mapper_routes = Blueprint('mapper_routes', __name__)


################################# mapper path, circle, connected component selection ########################################
@mapper_routes.route('/click_select_component', methods=('GET', 'POST'))
def get_component():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    
    response_data = request.get_json()
    node_id = response_data['name']
    component = mapper_graph.get_component(node_id)
    if component == -1:
        component = [node_id]
    else:
        component = [str(item) for item in component]
    return {'component': component}

@mapper_routes.route('/click_select_path', methods=('GET', 'POST'))
def get_path():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    
    response_data = request.get_json()
    node_1 = response_data['node1']
    node_2 = response_data['node2']
    path = mapper_graph.shortest_path(node_1, node_2) 
    path = [] if path == -1 else [str(item) for item in path]
    return {'data': path}

@mapper_routes.route('/click_select_circle', methods=('GET', 'POST'))
def get_circle():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    
    response_data = request.get_json()
    node_1 = response_data['node1']
    node_2 = response_data['node2']
    circle = mapper_graph.smallest_circle(node_1, node_2)
    circle = [] if circle == -1 else [str(item) for item in circle]
    return {'data': circle}
################################# mapper path component selection ########################################



################################# mapper paramater tune ########################################
@mapper_routes.route('/getminPtsLineChart', methods=('GET', 'POST'))
def get_minPts_line_chart_data():
    # show the line chart data for epsilon elbow
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    raw_data = user_instances['raw_data']
    
    response_data = request.get_json()
    minPtsValue = response_data['minPtsValue'] 
    activation  = raw_data.get_original_activation_data()
    subsample_size = 10000
    chart_data = elbow_eps_raw(activation, minPtsValue, "Embedding", 'rgba(75,192,192,1)', subsample_size=subsample_size)
    chart_data = {
        'labels': [i for i in range(subsample_size if len(activation) > subsample_size else len(activation))],  # Rounded bin labels
        'datasets': [chart_data]
    }
    return jsonify(chart_data)

# compute mapper graph with new parameters
@mapper_routes.route('/runMapper', methods=('GET', 'POST'))
def run_mapper():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    classical_mapper_obj = user_instances['classical_mapper_obj']
    metadata = user_instances['metadata']
    response_data = request.get_json()
    mapper_type = response_data['mapperType'] # cover_val, overlap_val, eps_val, minPts_val, label_df, unique_label_list

    def load_mapper_data(mapper, data_source, eps_val, minPts_val=None, cover_val=None, overlap_val=None, cover_strategy='uniform'):
        # Get unique labels dynamically from metadata using CATEGORY_ATTRIBUTE
        unique_labels = get_unique_labels(user_instances)
        
        if mapper_type == 'classicalMapper':
            mapper_data, eps_val = classical_mapper_obj.create_mapper(data_source, 
                                                             eps_val=eps_val, 
                                                             minPts_val = minPts_val, 
                                                             cover_val = cover_val, 
                                                             overlap_val = overlap_val, 
                                                             label_df = metadata, 
                                                             unique_label_list = unique_labels, 
                                                             use_automatic_eps = False,
                                                             cover_strategy = cover_strategy)
        elif mapper_type == 'ballMapper':
            mapper_data, eps_val = create_ball_mapper(data_source, eps_val, metadata, unique_labels)
        mapper.load_graph(mapper_data, eps_val)  

    eps_val = response_data['epsValue']
    if mapper_type == 'classicalMapper':
        minPts_val = response_data['minPtsValue']
        cover_val = response_data['coverValue']
        overlap_val = response_data['overlapValue']
        cover_strategy = response_data.get(
            'coverStrategy',
            user_instances.get('mapper_params', {}).get('cover_strategy', 'uniform')
        )
    else:
        minPts_val = cover_val = overlap_val = None
        cover_strategy = 'uniform'
    load_mapper_data(mapper_graph, raw_data, eps_val, minPts_val, cover_val, overlap_val, cover_strategy)
    return '', 204 # compute successfully
################################# mapper paramater tune ########################################