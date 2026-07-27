from flask import Blueprint, request, jsonify, session
from explanationAgents import get_edge_summary, get_path_summary, get_comparison_summary, get_node_summary
from models.explanationHelper import from_vertices_to_LLM_input, from_perturbation_to_LLM_input, get_perturbation_sentence_ids, sample_LLM_inputs
from perturbation import get_perturbation_LLM_inputs 
from utils import CONSISTENCY_METRIC_COSINE, compute_consistency_score
import random
import time
from user_manager import get_user_data
random.seed(42)

explanation_routes = Blueprint('explanation_routes', __name__)


def _log_node_summary_latency(start_time, endpoint, node_id):
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    print(f"[timing] {endpoint} node_id={node_id} latency_ms={elapsed_ms:.2f}")


def _get_consistency_metric(response_data):
    return response_data.get('consistency_metric', CONSISTENCY_METRIC_COSINE)


################################ LLM explanation start ########################################
# get the explanation for the node, edge, path, or component
@explanation_routes.route('/explanation', methods=('GET', 'POST'))
def get_explanation():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    perturb_embeds = user_instances['perturb_embeds']
    metadata = user_instances['metadata']
    perturb_metadata = user_instances['perturb_metadata']
    node_explanations = user_instances['node_explanations']
    component_explanations = user_instances['component_explanations']
    
    response_data = request.get_json()
    consistency_metric = _get_consistency_metric(response_data)
    selectedInstancesObj = response_data['selectedInstancesObj'] # {instances: [int, int, ...], startId: 'manual'} 
    start_id = selectedInstancesObj['startId']

    if start_id == 'mapper-node':
        node_id = selectedInstancesObj['nodeId']

        # Check if we have cached explanation for this node
        if str(node_id) in node_explanations:
            # Use cached explanation
            cached_explanation = node_explanations[str(node_id)]
            original_summary = cached_explanation['original_summary']
            perturbation_summary = cached_explanation['perturbation_summary']
            if consistency_metric == CONSISTENCY_METRIC_COSINE:
                similarity_score = cached_explanation['similarity_score']
            else:
                similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
            print(f"Using cached explanation for node {node_id}")
        else:
            # Generate fresh explanation (fallback)
            vertices = mapper_graph.get_node_content(node_id)
            perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
            sampled_vertices, sampled_perturbation_ids = sample_LLM_inputs(vertices, perturbation_ids)
            LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)

            # Cap LLM inputs to keep prompt size manageable
            if len(sampled_vertices) > 170:
                LLM_sampled_original_input_instances = random.sample(LLM_original_input_instances, 170)
                LLM_sampled_perturbation_input_instances = random.sample(LLM_perturbation_input_instances, 170)
            else:
                LLM_sampled_original_input_instances = LLM_original_input_instances
                LLM_sampled_perturbation_input_instances = LLM_perturbation_input_instances

            original_summary = get_node_summary(LLM_sampled_original_input_instances)
            perturbation_summary = get_node_summary(LLM_sampled_perturbation_input_instances)
            similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
            print(f"Generated fresh explanation for node {node_id}")

        # Always generate fresh perturbation data (reuse if already computed above)
        if str(node_id) not in node_explanations:
            # Already computed above in the else block
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        else:
            # Need to compute fresh perturbation data
            vertices = mapper_graph.get_node_content(node_id)
            perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
            print('perturbation_ids:', perturbation_ids)
            sampled_vertices, sampled_perturbation_ids = sample_LLM_inputs(vertices, perturbation_ids)
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)

        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            "LLM_as_judge_summary": "",
            "perturb_sentences": [item['sentence'] for item in LLM_perturbation_input_instances],
            "perturbation_flags": [isinstance(pid, int) for pid in sampled_perturbation_ids]
        }
        summary = jsonify(summary)

    elif start_id == 'mapper-edge': # {'start_id': 'mapper-edge', 'nodePair': end_nodes}
        nodePair = selectedInstancesObj['nodePair']
        edge_vertices, unique_source_vertices, unique_target_vertices = mapper_graph.get_edge_content(nodePair[0], nodePair[1])
        edge_perturbation_ids = get_perturbation_sentence_ids(edge_vertices, raw_data, perturb_embeds, mapper_graph) # corresponding perturbation ids for each vertex [int, int, "original-vertex"...]
        unique_souce_perturbation_ids = get_perturbation_sentence_ids(unique_source_vertices, raw_data, perturb_embeds, mapper_graph)
        unique_target_perturbation_ids = get_perturbation_sentence_ids(unique_target_vertices, raw_data, perturb_embeds, mapper_graph) 

        # get the sampled original LLM and perturbation LLM ids
        sampled_edge_vertices, sampled_edge_perturbation_ids = sample_LLM_inputs(edge_vertices, edge_perturbation_ids)
        sampled_source_vertices, sampled_source_perturbation_ids = sample_LLM_inputs(unique_source_vertices, unique_souce_perturbation_ids)
        sampled_target_vertices, sampled_target_perturbation_ids = sample_LLM_inputs(unique_target_vertices, unique_target_perturbation_ids)

        LLM_original_edge_instances = from_vertices_to_LLM_input(sampled_edge_vertices, metadata)
        LLM_source_input_instances = from_vertices_to_LLM_input(sampled_source_vertices, metadata)
        LLM_target_input_instances = from_vertices_to_LLM_input(sampled_target_vertices, metadata)
        LLM_perturbation_edge_instances = from_perturbation_to_LLM_input(sampled_edge_perturbation_ids, metadata, perturb_metadata)
        LLM_source_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_source_perturbation_ids, metadata, perturb_metadata)
        LLM_target_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_target_perturbation_ids, metadata, perturb_metadata)

        original_summary = get_edge_summary(LLM_original_edge_instances, LLM_source_input_instances, LLM_target_input_instances)
        perturbation_summary = get_edge_summary(LLM_perturbation_edge_instances, LLM_source_perturbation_input_instances, LLM_target_perturbation_input_instances)
        similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            "perturb_sentences": {
                "shared": [item['sentence'] for item in LLM_perturbation_edge_instances],
                "source": [item['sentence'] for item in LLM_source_perturbation_input_instances],
                "target": [item['sentence'] for item in LLM_target_perturbation_input_instances]
            },
            "perturbation_flags": {
                "shared": [isinstance(pid, int) for pid in sampled_edge_perturbation_ids],
                "source": [isinstance(pid, int) for pid in sampled_source_perturbation_ids],
                "target": [isinstance(pid, int) for pid in sampled_target_perturbation_ids]
            }
        }
        summary = jsonify(summary)
        # summary = get_edge_summary(edge_LLM_input_instances, source_LLM_input_instances, target_LLM_input_instances) 

    elif start_id == 'mapper-component': # {'start_id': 'mapper-component', 'nodeIdList': []}
        node_id_list = selectedInstancesObj['nodeIdList']
        
        # Try to use cached component explanation
        component_id = mapper_graph.node_to_component[node_id_list[0]]
        if f'comp_{component_id}' in component_explanations:
            # Use cached explanation
            cached_explanation = component_explanations[f'comp_{component_id}']
            original_summary = cached_explanation['original_summary']
            perturbation_summary = cached_explanation['perturbation_summary']
            if consistency_metric == CONSISTENCY_METRIC_COSINE:
                similarity_score = cached_explanation['similarity_score']
            else:
                similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
            print(f"Using cached explanation for component {component_id}")
        else:
            # Generate fresh explanation (fallback)
            # Use the same ordering logic as frontend: iterate through nodes and concatenate vertices
            vertices = []
            for node_id in node_id_list:
                node_vertices = mapper_graph.get_node_content(node_id)
                vertices.extend(node_vertices)
            # Remove duplicates while preserving order (same as frontend's Set.from())
            vertices = list(dict.fromkeys(vertices))
            
            perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
            # Use all instances instead of sampling for component to maintain correspondence
            sampled_vertices, sampled_perturbation_ids = vertices, perturbation_ids
            # get the sampled original LLM and perturbation LLM ids
            LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
            # #TEMPORARY: specific for mapper component to reduce the number of vertices
            if len(sampled_vertices) > 170:
                LLM_sampled_original_input_instances = random.sample(LLM_original_input_instances, 170)
                LLM_sampled_perturbation_input_instances = random.sample(LLM_perturbation_input_instances, 170)
            else:
                LLM_sampled_original_input_instances = LLM_original_input_instances
                LLM_sampled_perturbation_input_instances = LLM_perturbation_input_instances
            # get the explanation summary
            original_summary = get_node_summary(LLM_sampled_original_input_instances)
            perturbation_summary = get_node_summary(LLM_sampled_perturbation_input_instances)
            similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
            print(f"Generated fresh explanation for component {component_id}")
        
        # Always generate fresh perturbation data (reuse if already computed above)
        if f'comp_{component_id}' not in component_explanations:
            # Already computed above in the else block
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        else:
            # Need to compute fresh perturbation data
            vertices = []
            for node_id in node_id_list:
                node_vertices = mapper_graph.get_node_content(node_id)
                vertices.extend(node_vertices)
            vertices = list(dict.fromkeys(vertices))
            perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
            sampled_vertices, sampled_perturbation_ids = vertices, perturbation_ids
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        
        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            "perturb_sentences": [item['sentence'] for item in LLM_perturbation_input_instances],
            "perturbation_flags": [isinstance(pid, int) for pid in sampled_perturbation_ids]
        }
        summary = jsonify(summary)

    elif start_id == 'mapper-path': # {}'startId': 'mapper-path', 'path-nodes': path}
        ori_path_node_list = selectedInstancesObj['path-nodes']
        # if path length > 10, take both ends and evey 2nd node in between
        if len(ori_path_node_list) > 15:
            path_node_list = ori_path_node_list[::2]
            if ori_path_node_list[-1] not in path_node_list:
                path_node_list.append(ori_path_node_list[-1])
        else:
            path_node_list = ori_path_node_list

        # Build per-node LLM inputs with ALL vertices (no sampling)
        LLM_original_path_input = []
        LLM_perturbation_path_input = []

        # Build a flattened, order-preserving dedup list of vertices for 1:1 alignment with table rows
        ordered_vertices = []
        vertex_to_pid = {}

        for node_id in path_node_list:
            vertices = mapper_graph.get_node_content(node_id)

            # Extend ordered list (will dedup later), and compute per-node perturbation ids
            ordered_vertices.extend(vertices)
            perturbation_ids_node = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)

            # Per-node original and perturbation inputs (for summaries)
            LLM_original_input_instances = from_vertices_to_LLM_input(vertices, metadata)
            LLM_perturbation_input_instances = from_perturbation_to_LLM_input(perturbation_ids_node, metadata, perturb_metadata)
            LLM_original_path_input.append(LLM_original_input_instances)
            LLM_perturbation_path_input.append(LLM_perturbation_input_instances)

            # Map first-seen vertex to its perturbation id to preserve first-occurrence semantics
            for v, pid in zip(vertices, perturbation_ids_node):
                if v not in vertex_to_pid:
                    vertex_to_pid[v] = pid

        # Order-preserving dedup to mirror frontend behavior
        ordered_vertices = list(dict.fromkeys(ordered_vertices))

        # Build flattened pid list in that exact order
        flat_perturbation_ids = [vertex_to_pid[v] for v in ordered_vertices]
        flat_perturbation_inputs = from_perturbation_to_LLM_input(flat_perturbation_ids, metadata, perturb_metadata)

        # get the explanation summary (still using per-node inputs)
        original_summary = get_path_summary(LLM_original_path_input)
        perturbation_summary = get_path_summary(LLM_perturbation_path_input)
        similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)

        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            # Flat arrays aligned to table row order
            "perturb_sentences": [item['sentence'] for item in flat_perturbation_inputs],
            "perturbation_flags": [isinstance(pid, int) for pid in flat_perturbation_ids]
        }
        summary = jsonify(summary)
    return summary

@explanation_routes.route('/comparison_explanation', methods=('POST',))
def get_comparison_explanation():
    """Retrieve explanation for comparison of selected nodes."""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    perturb_embeds = user_instances['perturb_embeds']
    perturb_metadata = user_instances['perturb_metadata']
    metadata = user_instances['metadata']
    node_explanations = user_instances['node_explanations']
    component_explanations = user_instances['component_explanations']
    response_data = request.get_json()
    consistency_metric = _get_consistency_metric(response_data)
    focus_instances = response_data.get('selectedInstances')  # [instance1, instance2, ...]
    comparison_instances = mapper_graph.get_vertices_ids_in_nodes(response_data.get('comparisonNodeIdLst'))  # [node id1, ...]
    # Get the focus instances and comparison instances for perturbation
    focus_perturbation_ids = get_perturbation_sentence_ids(focus_instances, raw_data, perturb_embeds, mapper_graph)  # corresponding perturbation ids for each vertex [int, int, "original-vertex"...]
    comparison_perturbation_ids = get_perturbation_sentence_ids(comparison_instances, raw_data, perturb_embeds, mapper_graph)  # corresponding perturbation ids for each vertex [int, int, "original-vertex"...]
    # Sample the original and perturbation LLM inputs
    sampled_focus_vertices, sampled_focus_perturbation_ids = sample_LLM_inputs(focus_instances, focus_perturbation_ids, 100)
    sampled_comparison_vertices, sampled_comparison_perturbation_ids = sample_LLM_inputs(comparison_instances, comparison_perturbation_ids, 100)
    # Get the sampled original LLM and perturbation LLM ids
    focus_LLM_input_instances = from_vertices_to_LLM_input(sampled_focus_vertices, metadata)
    focus_perturbation_LLM_input_instances = from_perturbation_to_LLM_input(sampled_focus_perturbation_ids, metadata, perturb_metadata)
    comparison_LLM_input_instances = from_vertices_to_LLM_input(sampled_comparison_vertices, metadata)
    comparison_perturbation_LLM_input_instances = from_perturbation_to_LLM_input(sampled_comparison_perturbation_ids, metadata, perturb_metadata)
    # Get the comparison explanation summary for original and perturbation
    original_summary = get_comparison_summary(focus_LLM_input_instances, comparison_LLM_input_instances)  
    perturbation_summary = get_comparison_summary(focus_perturbation_LLM_input_instances, comparison_perturbation_LLM_input_instances)
    # Calculate similarity score
    similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
    # Prepare the summary data
    summary = {
        "original_summary": original_summary,
        "perturbation_summary": perturbation_summary,
        "similarity_score": similarity_score,
        "perturb_sentences": {
            "focus": [item['sentence'] for item in focus_perturbation_LLM_input_instances],
            "comparison": [item['sentence'] for item in comparison_perturbation_LLM_input_instances]
        },
        "perturbation_flags": {
            "focus": [isinstance(pid, int) for pid in sampled_focus_perturbation_ids],
            "comparison": [isinstance(pid, int) for pid in sampled_comparison_perturbation_ids]
        }
    }
    # Return the summary as JSON response
    return jsonify(summary)

@explanation_routes.route('/perturbed_explanation', methods=('GET', 'POST')) 
def get_perturbed_explanation():
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    metadata = user_instances['metadata']
    input_data = request.get_json()['input'] # {type: 'node', nodeId: 1}
    explanation_type = input_data.get('type')
    if explanation_type != 'node':
        return jsonify({"error": f"Unsupported type: {explanation_type}"}), 400

    node_id = input_data['nodeId']
    vertices = mapper_graph.get_node_content(node_id)
    LLM_input_instances = from_vertices_to_LLM_input(vertices, metadata, len(vertices))
    embeddings = [raw_data.get_instance_embedding(idx) for idx in vertices]
    final_LLM_inputs, perturbation_inputs, belong_percentage = get_perturbation_LLM_inputs(
        LLM_input_instances, embeddings, user_instances=user_instances
    )
    summary = get_node_summary(final_LLM_inputs)
    return {
        "perturb_sentences": perturbation_inputs,
        "perturb_explanation": summary,
        "ratio": belong_percentage
    }

@explanation_routes.route('/consistency_score', methods=('POST',))
def get_consistency_score():
    response_data = request.get_json()
    consistency_metric = _get_consistency_metric(response_data)
    original_summary = response_data.get('original_summary')
    perturbation_summary = response_data.get('perturbation_summary')
    if original_summary is None or perturbation_summary is None:
        return jsonify({"error": "original_summary and perturbation_summary are required"}), 400
    similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
    return jsonify({
        "similarity_score": similarity_score,
        "consistency_metric": consistency_metric
    })


################################# LLM explanation end ########################################


# get all components {} key: component_id, value: [node1, node2, ...]
@explanation_routes.route('/get_components_keywords', methods=('GET', 'POST'))
def get_components_keywords():
    """
    A list of dict:  
    [{component_id: [],  "nodeIds": [], "keywords": [using the original summary], "sim": num}, ..]
    """
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    component_explanations = user_instances['component_explanations']
    
    all_components = mapper_graph.component_to_nodes # key: component_id, value: list of node_ids
    output = []
    
    for comp_idx, node_ids in all_components.items():
        if f'comp_{comp_idx}' in component_explanations:
            explanations = component_explanations[f'comp_{comp_idx}']
            try:
                keywords = explanations['original_summary']['keywords']
            except:
                keywords = ['', '', '']
            output.append({
                "component_id": comp_idx,
                "nodeIds": node_ids,
                "keywords": keywords,
                "sim": explanations['similarity_score'] if True else 1
            })
    return output


@explanation_routes.route('/get_nodes_keywords', methods=('GET', 'POST'))
def get_nodes_keywords():
    """
    A list of dict:  
    [{node_id: int, "keywords": [keywords], "sim": num}, ..]
    """
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    node_explanations = user_instances['node_explanations']
    
    all_nodes = mapper_graph.all_node_idx  # key: node_id, value: component_id
    output = []

    for node_id in all_nodes:
        if str(node_id) in node_explanations:
            explanations = node_explanations[str(node_id)]
            print('explanations:', explanations)
            try:
                keywords = explanations['original_summary']['keywords']
            except:
                keywords = ['', '', '']
            output.append({
                "node_id": node_id,
                "keywords": keywords,
                "sim": explanations['similarity_score'] if True else 1
            })
    return jsonify(output)

@explanation_routes.route('/update_layer', methods=('POST',))
def update_layer():
    """Update the current layer for a user and reload explanations"""
    user_id = session['user_id']
    response_data = request.get_json()
    layer_num = response_data.get('layer_num', 12)  # default to layer 12
    
    # Update user's layer data (this will reload explanations)
    from user_manager import update_user_layer_data
    update_user_layer_data(user_id, layer_num)
    
    return jsonify({"status": "success", "layer": layer_num})

@explanation_routes.route('/refresh_explanation', methods=('POST',))
def refresh_explanation():
    """Generate fresh explanation on-the-fly (bypassing cache)"""
    request_start_time = time.perf_counter()
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    raw_data = user_instances['raw_data']
    perturb_embeds = user_instances['perturb_embeds']
    perturb_metadata = user_instances['perturb_metadata']
    metadata = user_instances['metadata']
    
    response_data = request.get_json()
    consistency_metric = _get_consistency_metric(response_data)
    selectedInstancesObj = response_data.get('selectedInstancesObj')
    start_id = selectedInstancesObj.get('startId')
    
    if start_id == 'mapper-node':
        node_id = selectedInstancesObj['nodeId']
        vertices = mapper_graph.get_node_content(node_id)
        perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
        sampled_vertices, sampled_perturbation_ids = sample_LLM_inputs(vertices, perturbation_ids)
        
        # Generate fresh explanations
        LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
        LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        original_summary = get_node_summary(LLM_original_input_instances)
        perturbation_summary = get_node_summary(LLM_perturbation_input_instances)
        similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
        
        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            "LLM_as_judge_summary": "",
            "perturb_sentences": [item['sentence'] for item in LLM_perturbation_input_instances],
            "perturbation_flags": [isinstance(pid, int) for pid in sampled_perturbation_ids]
        }
        _log_node_summary_latency(request_start_time, "/refresh_explanation", node_id)
        
    elif start_id == 'mapper-component':
        node_id_list = selectedInstancesObj['nodeIdList']
        vertices = []
        for node_id in node_id_list:
            node_vertices = mapper_graph.get_node_content(node_id)
            vertices.extend(node_vertices)
        vertices = list(dict.fromkeys(vertices))
        
        perturbation_ids = get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph)
        sampled_vertices, sampled_perturbation_ids = vertices, perturbation_ids
        LLM_original_input_instances = from_vertices_to_LLM_input(sampled_vertices, metadata)
        LLM_perturbation_input_instances = from_perturbation_to_LLM_input(sampled_perturbation_ids, metadata, perturb_metadata)
        
        if len(sampled_vertices) > 170:
            LLM_sampled_original_input_instances = random.sample(LLM_original_input_instances, 170)
            LLM_sampled_perturbation_input_instances = random.sample(LLM_perturbation_input_instances, 170)
        else:
            LLM_sampled_original_input_instances = LLM_original_input_instances
            LLM_sampled_perturbation_input_instances = LLM_perturbation_input_instances
        
        original_summary = get_node_summary(LLM_sampled_original_input_instances)
        perturbation_summary = get_node_summary(LLM_sampled_perturbation_input_instances)
        similarity_score = compute_consistency_score(original_summary, perturbation_summary, consistency_metric)
        
        summary = {
            "original_summary": original_summary,
            "perturbation_summary": perturbation_summary,
            "similarity_score": similarity_score,
            "perturb_sentences": [item['sentence'] for item in LLM_perturbation_input_instances],
            "perturbation_flags": [isinstance(pid, int) for pid in sampled_perturbation_ids]
        }
    
    else:
        # For other types (edge, path), use the regular endpoint
        return get_explanation()
    
    return jsonify(summary)

