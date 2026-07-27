from flask import Blueprint, request, session
import numpy as np
import pandas as pd
from sklearn.neighbors import KDTree
from collections import defaultdict
from explanationAgents import get_perturbation_path_safeguard, get_trajectory_edit_spans
from perturbation import generate_embeddings
from user_manager import get_user_data

trajectory_routes = Blueprint('trajectory_routes', __name__)


def _format_focus_sentence(metadata, sentence_id):
    word_id, word, sentence = metadata.loc[sentence_id, ['word_id', 'word', 'sentence']].values.tolist()
    return ' '.join([
        f"[{word}]" if i == word_id - 1 else token
        for i, token in enumerate(sentence.split())
    ])


################################# Trajectory exploration related ########################################
@trajectory_routes.route('/sorted_instances', methods=('POST',))
def get_sorted_instances():
    """Sort selected instances based on thier embeddigs to their center used for dropdown list."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    metadata = user_instances['metadata']
    
    response_data = request.get_json()
    selected_instances = response_data['selectedInstances']  # List of selected instance IDs
    use_node_id = response_data['useNodeId']  # Whether to sort by node ID
    vertices = selected_instances if not use_node_id else mapper_graph.get_vertices_ids_in_nodes(selected_instances)
    center = np.mean([raw_data.get_instance_embedding(idx) for idx in vertices], axis=0)
    sorted_vertices = sorted(vertices, key=lambda idx: np.linalg.norm(raw_data.get_instance_embedding(idx) - center))
    titles = ['idx', 'word_id', 'word', 'label', 'sentence']
    rows = metadata.iloc[sorted_vertices][titles].values.tolist()
    return {'rows': rows}

@trajectory_routes.route('/perturbation_trajectory', methods=('POST',))
def get_trajectory():
    """Compute intermediate sentences between source and target sentences."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    response_data = request.get_json()
    source_sentence_id = response_data.get("sourceSentenceId")
    target_sentence_id = response_data.get("targetSentenceId")

    titles = ['word_id', 'word', 'sentence']

    # Process source sentence
    source_row = metadata.loc[source_sentence_id, titles].values.tolist()
    print('source_row:', source_row)
    source_word_id, source_word, source_sentence = source_row
    source_sentence = ' '.join([f"[{source_word}]" if i == source_word_id-1 else word for i, word in enumerate(source_sentence.split())])

    # Process target sentence
    target_row = metadata.loc[target_sentence_id, titles].values.tolist()
    target_word_id, target_word, target_sentence = target_row
    target_sentence = ' '.join([f"[{target_word}]" if i == target_word_id-1 else word for i, word in enumerate(target_sentence.split())])

    # Add source and target sentences to the result
    two_end_sentences = [
        {'word': source_word, 'sentence': source_sentence},
        {'word': target_word, 'sentence': target_sentence}
    ] 
    summary = get_perturbation_path_safeguard(source_sentence, target_sentence, use_temp_example=False)
    return summary


@trajectory_routes.route('/insert_perturbation_trajectory', methods=('POST',))
def insert_trajectory():
    """Compute intermediate sentences between source and target sentences."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    response_data = request.get_json()
    source_sentence = response_data.get("sourceSentence") # with []
    target_sentence = response_data.get("targetSentence")

    summary = get_perturbation_path_safeguard(source_sentence, target_sentence, use_temp_example=False) #{sentences: [], summary: ''}
    return {'sentences': summary['sentences'][1:-1]}


@trajectory_routes.route('/trajectory_edit_spans', methods=('POST',))
def trajectory_edit_spans():
    """Detect edited spans across a whole trajectory sequence in one request."""
    response_data = request.get_json()
    sentences = response_data.get("sentences", [])

    normalized_sentences = []
    for sentence in sentences:
        if isinstance(sentence, str):
            normalized_sentences.append(sentence)
        elif isinstance(sentence, dict):
            tokens = sentence.get("sentence", [])
            if isinstance(tokens, list):
                normalized_sentences.append(" ".join(tokens))
            else:
                normalized_sentences.append(str(tokens))

    return get_trajectory_edit_spans(normalized_sentences)


@trajectory_routes.route("/attach_perturb_project_mapper", methods=["POST"])
def get_attach_perturb_project_mapper(): 
    # get the perturbation data
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    request_data = request.get_json()
    sentence_objs = request_data.get('sentenceObjs')
    source_node_id = request_data.get('sourceNodeId')
    target_node_id = request_data.get('targetNodeId')

    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    classical_mapper_obj = user_instances['classical_mapper_obj']

    # get the perturbation embeddings
    all_embeds = [
        generate_embeddings(sentence_obj, user_instances=user_instances)
        for sentence_obj in sentence_objs
    ]
    all_embeds = raw_data.transform_embeddings(all_embeds)
    mapper_nodes = [source_node_id, target_node_id]
    graph_component_ids = set()    # all component ids related to the nodes of perturbation

    # ?
    path_node = mapper_graph.shortest_path(mapper_nodes[0], mapper_nodes[1])
    nodes_related_path = mapper_nodes if path_node == -1 else path_node # get the nodes on the path and other nodes that have perturbations

    # get the new projection data 
    project = user_instances['projection'].get_perturb_project(all_embeds)
    project_data = {
        'x': project[:, 0],
        'y': project[:, 1],
        'id': [i for i in range(len(all_embeds))]
    }
    project_data_df = pd.DataFrame(project_data)
    project_result = project_data_df.to_dict(orient='records')
    # print(project_result)

    # mapper data: strict perturbation
    # For each perturbation: 1. get the cubes that contain this perturbation 2. get mapper nodes that are within these cubes. 
    # 3. get all instances within these nodes 4. compute the nearest instance to this perturbation 5. get the mapper nodes that contain this instance
    all_node_ids = [node['id'] for node in mapper_graph.graph_data['nodes']] # example: cube1_cluster0
    temp_assignment = {node_id: [] for node_id in all_node_ids} # Temporary dictionary to store assignments
    temp_assigment_perturb = {} # Temporary dictionary to store assignments: perturbation index -> [node ids]
    for perturb_idx, ori_perturb_embed in enumerate(all_embeds):
        perturb_embed = ori_perturb_embed
        cube_ids = classical_mapper_obj.get_cube_id(perturb_embed) 
        node_ids_in_cubes = [node_id for node_id in all_node_ids if any(f'cube{cube_id}' in node_id for cube_id in cube_ids)]
        vertice_ids_in_nodes = mapper_graph.get_vertices_ids_in_nodes(node_ids_in_cubes)
        if not vertice_ids_in_nodes:
            # Fallback: search against all vertices currently in the mapper graph
            vertice_ids_in_nodes = mapper_graph.get_all_vertices_in_graph()
        embeds_on_vertice_ids = [raw_data.get_instance_embedding(idx) for idx in vertice_ids_in_nodes]
        if not embeds_on_vertice_ids:
            temp_assigment_perturb[perturb_idx] = []
            continue
        kdtree = KDTree(embeds_on_vertice_ids)
        _, closest_vertice_idx = kdtree.query([perturb_embed], k=1)
        closest_vertice_idx = closest_vertice_idx[0][0]
        closest_vertice_id = vertice_ids_in_nodes[closest_vertice_idx]
        node_name_list = mapper_graph.get_nodes_containing_vertex(closest_vertice_id)
        for node_name in node_name_list:
            graph_component_ids.add(mapper_graph.node_to_component[node_name])
        temp_assigment_perturb[perturb_idx] = node_name_list
    for perturb_idx, node_name_list in temp_assigment_perturb.items():
        for node_name in node_name_list:
            temp_assignment[node_name].append(perturb_idx) 
    mappernode_to_perturb_map = {node_id: indices for node_id, indices in temp_assignment.items() if len(indices)!=0} # node1_id: []
    
    # Create a dictionary to store node/edge to perturbation id mapping
    node_edge_mapping = defaultdict(list)
    # Process the data
    for perturb_id, nodes in temp_assigment_perturb.items():
        if len(nodes) == 1: 
            node_edge_mapping[nodes[0]].append(perturb_id)  # Single node
            if nodes[0] not in nodes_related_path:
                    nodes_related_path.append(nodes[0])
        else:
            # Sort the nodes in order to make it align with the path order in nodes_on_path
            if nodes[0] in nodes_related_path and nodes[1] in nodes_related_path:
                node1_idx_in_path = nodes_related_path.index(nodes[0])
                node2_idx_in_path = nodes_related_path.index(nodes[1])
            else:
                # if the nodes are not in the path, sort them in alphabetical order
                nodes = sorted(nodes)
                node1_idx_in_path = 0
                node2_idx_in_path = 1
                if nodes[0] not in nodes_related_path:
                    nodes_related_path.append(nodes[0])
                if nodes[1] not in nodes_related_path:
                    nodes_related_path.append(nodes[1])
            if node1_idx_in_path < node2_idx_in_path:
                ordered_edge_nodes = [nodes[0], nodes[1]]
            else:
                ordered_edge_nodes = [nodes[1], nodes[0]]
            edge_key = "--".join(sorted(ordered_edge_nodes)) # Canonical undirected edge key

            node_edge_mapping[edge_key].append(perturb_id)  # Edge
    # Convert defaultdict to regular dict for output
    node_edge_mapping = dict(node_edge_mapping)
    mapper_result  = {"related_nodes": nodes_related_path, "perturb_mapping": node_edge_mapping,
                       "node_to_perturb": mappernode_to_perturb_map, "related_components": list(graph_component_ids)}


    return {'project': project_result, 'mapper': mapper_result}

################################# Trajectory exploration related End ########################################


