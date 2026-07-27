'''
helper functions for downloading the input for batching component explanations
'''
from flask import Blueprint, session
from models.explanationHelper import get_perturbation_sentence_ids, sample_LLM_inputs, from_vertices_to_LLM_input, from_perturbation_to_LLM_input
import json
from user_manager import get_user_data  

helper_routes = Blueprint('helper_routes', __name__)

@helper_routes.route("/batch_component_input", methods=["POST"])
def get_batch_component_input():
    '''
    Store the input for the batch component explanations
    store into json format
    [ 
    {"id": comp_idx, "original_inputs": [], ""perturbation_inputs": []},    ...
    ]
    ''' 
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    perturb_embeds = user_instances['perturb_embeds']
    metadata = user_instances['metadata']
    perturb_metadata = user_instances['perturb_metadata']
    current_layer = user_instances['current_layer']

    response = [] 
    component_to_nodes = mapper_graph.component_to_nodes  # key: component_id, value: list of node_ids
    for comp_idx, node_ids in component_to_nodes.items():
        vertices = mapper_graph.get_vertices_ids_in_nodes(node_ids)
        perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph) # corresponding perturbation ids for each vertex [int, int, "original-vertex"...]
        sampled_vertices, sampled_perturbation_ids = sample_LLM_inputs(vertices, perturbation_ids, 170)
        # get the sampled original LLM and perturbation LLM ids
        LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
        LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        response.append({
            "id": f'comp_{comp_idx}',
            "original_inputs": LLM_original_input_instances,
            "perturbation_inputs": LLM_perturbation_input_instances
        })
    # save the response to a json file
    with open(f'./DataProcessor/GMB_modernBERT_component_data/batch_component_input_layer{current_layer}.json', 'w') as f:
        json.dump(response, f, indent=4)
    return {"status": "success", "data": response}


@helper_routes.route("/batch_node_input", methods=["POST"])
def get_batch_node_input():
    '''
    Store the input for the batch component explanations
    store into json format
    [ 
    {"id": node_id, "original_inputs": [], ""perturbation_inputs": []},    ...
    ]
    ''' 
    response = []
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    perturb_embeds = user_instances['perturb_embeds']
    metadata = user_instances['metadata']
    perturb_metadata = user_instances['perturb_metadata']
    current_layer = user_instances['current_layer']
    # get the node ids from the mapper graph
    node_ids = mapper_graph.get_all_node_ids()

    for node_id in node_ids:
        vertices = mapper_graph.get_node_content(node_id) # get the vertices ids in the node
        perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph) # corresponding perturbation ids for each vertex [int, int, "original-vertex"...]
        sampled_vertices, sampled_perturbation_ids = sample_LLM_inputs(vertices, perturbation_ids, 170)
        # get the sampled original LLM and perturbation LLM ids
        LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
        LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        response.append({
            "id": f'{node_id}',
            "original_inputs": LLM_original_input_instances,
            "perturbation_inputs": LLM_perturbation_input_instances
        })
    # save the response to a json file
    with open(f'./DataProcessor/GMB_modernBERT_node_data/batch_node_input_layer{current_layer}.json', 'w') as f:
        json.dump(response, f, indent=4)
    return {"status": "success", "data": response}