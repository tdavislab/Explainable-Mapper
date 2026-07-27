from flask import Blueprint, request, session
import pandas as pd
from sklearn.neighbors import KDTree
from collections import defaultdict
import pickle
from user_manager import get_user_data
import copy

other_routes = Blueprint('other_routes', __name__)


################################ Perturbation based method ###############################
@other_routes.route("/get_perturb_obj", methods=["POST"])
def get_perturb_obj():
    """Fetch sentences based on selected perturbation file."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    request_data = request.json
    name = request_data.get("name")
    # ss_role-BertBase-413-3-case4_gpt_embeds.pkl
    file_path = f'./topobert_data/ss-role/perturbations/{name}.pkl'
    with open(file_path, "rb") as f:
        perturb_data = pickle.load(f)  # Assuming data is a list of dicts
    user_instances['perturb_data'] = perturb_data
    sentence_objs = perturb_data['sentence_objs']
    perturb_list = [
            {
                "focusword": obj["focus"],
                "sentence": obj["toks"],  # List of tokens
                "pos": obj["pos"]
            }
            for obj in sentence_objs  # Loop through each sentence object
        ]
    perturb_obj = copy.deepcopy(perturb_data)
    perturb_obj['sentence_objs'] = perturb_list
    return perturb_obj

@other_routes.route("/get_perturb_project_mapper", methods=["POST"])
def get_perturb_project(): 
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    perturb_data = user_instances.get('perturb_data')
    if not perturb_data:
        return {"error": "No perturbation data loaded for this session."}, 400

    sentence_objs = perturb_data['sentence_objs']
    all_embeds = [sentence_obj['embed'] for sentence_obj in sentence_objs]
    instance_idx_lst = perturb_data['instances']
    mapper_nodes = perturb_data['mapper_nodes'] # assume a path for now [node1, node 2]

    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    classical_mapper_obj = user_instances['classical_mapper_obj']
    projection = user_instances['projection']
    all_embeds = raw_data.transform_embeddings(all_embeds)

    # get the new projection data 
    project = projection.get_perturb_project(all_embeds)
    project_data = {
        'x': project[:, 0],
        'y': project[:, 1],
        'id': [i for i in range(len(all_embeds))]
    }
    project_data_df = pd.DataFrame(project_data)
    project_result = project_data_df.to_dict(orient='records')
    print(project_result)

    # get the new mapper data
    # 1. get all ids within this mapper, 2. for each perturbation, get the nearest id 3. find the mapper nodes that cotain this id 
    all_vertice_ids = mapper_graph.get_all_vertices_in_graph()
    embeds_on_all_vertice_ids = [raw_data.get_instance_embedding(idx) for idx in all_vertice_ids]
    all_node_ids = [node['id'] for node in mapper_graph.graph_data['nodes']]
    temp_assignment = {node_id: [] for node_id in all_node_ids} # Temporary dictionary to store assignments

    # Create a KDTree for efficient nearest neighbor search
    kdtree = KDTree(embeds_on_all_vertice_ids)
    for idx, embed in enumerate(all_embeds):
        # get the closest vertice id
        _, closest_vertice_idx = kdtree.query(embed)
        closest_vertice_id = all_vertice_ids[closest_vertice_idx]
        node_name_list = mapper_graph.get_nodes_containing_vertex(closest_vertice_id) 
        for node_name in node_name_list:
            temp_assignment[node_name].append(idx)

    # Remove empty entries
    mapper_result = {node_id: indices for node_id, indices in temp_assignment.items() if len(indices)!=0} # node1_id: []
    return {'project': project_result, 'mapper': mapper_result}

@other_routes.route("/get_strict_perturb_project_mapper", methods=["POST"])
def get_strict_perturb_project(): 
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    perturb_data = user_instances.get('perturb_data')
    if not perturb_data:
        return {"error": "No perturbation data loaded for this session."}, 400

    sentence_objs = perturb_data['sentence_objs']
    all_embeds = [sentence_obj['embed'] for sentence_obj in sentence_objs] # a seuqence of perturbation embeddings
    instance_idx_lst = perturb_data['instances']
    mapper_nodes = perturb_data['mapper_nodes'] # assume a path for now [node1, node 2]

    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    classical_mapper_obj = user_instances['classical_mapper_obj']
    projection = user_instances['projection']
    nodes_related_path = mapper_graph.shortest_path(mapper_nodes[0], mapper_nodes[1]) # get the nodes on the path and other nodes that have perturbations
    graph_component_ids = set()    # all component ids related to the nodes of perturbation
    all_embeds = raw_data.transform_embeddings(all_embeds)

    # get the new projection data 
    project = projection.get_perturb_project(all_embeds)
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
        # task: filter node ids in all_node_ids, where the node ids contain the cube ids
        node_ids_in_cubes = [node_id for node_id in all_node_ids if any(f'cube{cube_id}' in node_id for cube_id in cube_ids)]
        # task: get all vertice ids within these nodes
        vertice_ids_in_nodes = mapper_graph.get_vertices_ids_in_nodes(node_ids_in_cubes)
        embeds_on_vertice_ids = [raw_data.get_instance_embedding(idx) for idx in vertice_ids_in_nodes]
        # task: get the nearest vertice id to this perturbation
        kdtree = KDTree(embeds_on_vertice_ids)
        _, closest_vertice_idx = kdtree.query(perturb_embed)
        closest_vertice_id = vertice_ids_in_nodes[closest_vertice_idx]
        # task: get the nodes that contain this vertice id
        node_name_list = mapper_graph.get_nodes_containing_vertex(closest_vertice_id)
        # get the component ids related to the nodes of perturbation
        for node_name in node_name_list:
            graph_component_ids.add(mapper_graph.node_to_component[node_name])
        temp_assigment_perturb[perturb_idx] = node_name_list
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
                edge_key = "--".join(nodes) # Convert tuple to string
            else:                           
                edge_key = "--".join([nodes[1], nodes[0]])  # Convert tuple to string

            node_edge_mapping[edge_key].append(perturb_id)  # Edge
    # Convert defaultdict to regular dict for output
    node_edge_mapping = dict(node_edge_mapping)
    mapper_result  = {"related_nodes": nodes_related_path, "perturb_mapping": node_edge_mapping,
                       "node_to_perturb": mappernode_to_perturb_map, "related_components": list(graph_component_ids)}


    return {'project': project_result, 'mapper': mapper_result}

################################Perturbation based method ###############################
 
# get allTokens used for the token query [{label: 'token1'}, ...]
@other_routes.route('/get_all_words', methods=('GET', 'POST'))
def get_all_words():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    mapper_graph = user_instances['mapper_graph']
    
    # Get all vertices that are present in the mapper graph
    graph_vertices = mapper_graph.get_all_vertices_in_graph()
    
    # Filter metadata to only include vertices that are in the mapper graph
    graph_metadata = metadata.iloc[graph_vertices]
    
    # Get lemmas/words from the graph vertices (filter out None/NaN values)
    # Use 'lemma' if available, otherwise fall back to 'word'
    column_name = 'lemma' if 'lemma' in graph_metadata.columns else 'word'
    valid_words = graph_metadata[column_name].dropna()
    valid_words = [word.lower() for word in valid_words if word]
    
    # Count frequency of each word
    from collections import Counter
    word_counts = Counter(valid_words)
    
    # Sort words by frequency (most frequent first)
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    
    # print(f"Total words in dataset: {len(metadata['word'].unique())}")
    # print(f"Words in mapper graph: {len(sorted_words)}")
    
    return [{'label': word, 'count': count} for word, count in sorted_words]


# select a word and, return the selected instances
@other_routes.route('/select_a_word', methods=('GET', 'POST'))
def select_a_word():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    mapper_graph = user_instances['mapper_graph']
    
    response_data = request.get_json()
    selected_word = response_data.get('word') # null or a lemma
    
    if selected_word == None:
        selectedInstances = {'instances': [], 'startId': 'word_select'}
    else:
        # Get all vertices that are present in the mapper graph
        graph_vertices = mapper_graph.get_all_vertices_in_graph()
        graph_metadata = metadata.iloc[graph_vertices]
        
        # Find rows where lemma/word matches the selected word (case insensitive)
        # Use 'lemma' if available, otherwise fall back to 'word'
        column_name = 'lemma' if 'lemma' in graph_metadata.columns else 'word'
        matching_rows = graph_metadata[graph_metadata[column_name].str.lower() == selected_word.lower()]
        
        # Get the original indices (not the filtered graph indices)
        row_ids = matching_rows.index.tolist()
        
        print(f"Selected word/lemma ({column_name}): {selected_word}, found {len(row_ids)} instances")
        selectedInstances = {'instances': row_ids, 'startId': 'word_select'}
    
    return selectedInstances

# update the selectedNum attr for each category using selectedInstances
# [{'name': category, 'count': , 'color': , 'selectedNum':}, ...]
@other_routes.route('/update_selectedinstances', methods=('GET', 'POST'))
def update_selectedinstances():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    response_data = request.get_json()
    clickSelectionName = response_data.get('clickSelectionName') # null or a category name 
    if clickSelectionName == 'null':
        selectedInstances = {'instances': [], 'startId': 'reset'}
    else:
        category_attr = user_instances.get('CATEGORY_ATTRIBUTE', 'label')
        row_id_lst = metadata.index[metadata[category_attr] == clickSelectionName].tolist()
        selectedInstances = {'instances': row_id_lst, 'startId': 'manual'}
    return selectedInstances