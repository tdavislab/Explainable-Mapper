'''
This file contains helper functions for different types of explanation .
'''
from math import e
from scipy.spatial.distance import cdist
import random
import numpy as np
import re

def get_perturbation_sentence_ids(vertices, raw_data, perturb_embeds, mapper_graph=None):
    '''
    vertices: [int, int, ...] vertice ids
    raw_data: user-specific RawDataProcesser instance
    perturb_embeds: user-specific perturbation embeddings
    mapper_graph: GraphAnalysis instance for L2 range validation (optional)
    return: [int, int, ...] perturbation sentence ids, one to one mapping to the vertices 
    '''
    if len(vertices) == 0:
        return []
    if len(vertices) == 1:
        return [f'original-{vertices[0]}']
        
    vertices_embeddings = [raw_data.get_instance_embedding(vertex) for vertex in vertices]
    vertices_embeddings = np.array(vertices_embeddings)

    # compute the average pairwise distance for the selected vertices
    distances = cdist(vertices_embeddings, vertices_embeddings, metric='euclidean')
    np.fill_diagonal(distances, np.nan)  # exclude self-distances
    internal_avg_distance = np.nanmean(distances)

    # caches for per-node cluster cohesion (to avoid recomputation)
    node_embeds_cache = {}  # node_id -> np.ndarray of embeddings
    node_thresh_cache = {}  # node_id -> float internal avg distance

    perturbation_ids = []
    # for each vertex, find its perturbation id
    for vertex in vertices:
        # find its five perturbations
        perturb_embed = perturb_embeds[vertex*5: vertex*5+5]
        perturbation_id = f'original-{vertex}'    # if no perturbation is found
        for i, embedding in enumerate(perturb_embed):
            # Stage 1: L2 Range Check (if mapper_graph is provided)
            if mapper_graph and not mapper_graph.validate_perturbation_l2_range(vertex, embedding):
                continue  # Skip this perturbation - fails L2 range constraint
            
            # Stage 2: Cohesion against ALL clusters the original vertex belongs to
            ok_all_clusters = True
            if mapper_graph:
                related_nodes = mapper_graph.point_to_nodes.get(vertex, [])
                for node_id in related_nodes:
                    # prepare caches
                    if node_id not in node_embeds_cache:
                        node_vertices = mapper_graph.get_node_content(node_id)
                        node_embeds = np.array([raw_data.get_instance_embedding(idx) for idx in node_vertices])
                        node_embeds_cache[node_id] = node_embeds
                        D = cdist(node_embeds, node_embeds, metric='euclidean')
                        np.fill_diagonal(D, np.nan)
                        node_thresh_cache[node_id] = np.nanmean(D)
                    # check distance of embedding to this node cluster
                    avg_dist_to_node = np.mean(cdist(node_embeds_cache[node_id], embedding.reshape(1, -1), metric='euclidean'))
                    if avg_dist_to_node > node_thresh_cache[node_id]:
                        ok_all_clusters = False
                        break
                if not ok_all_clusters:
                    continue  # fails for at least one node → try next perturbation
            else:
                # fallback: original behavior using selected set cohesion
                avg_distance = np.mean(cdist(vertices_embeddings, embedding.reshape(1, -1), metric='euclidean'))
                if avg_distance > internal_avg_distance:
                    continue

            # passed both stages
            perturbation_id = vertex * 5 + i
            break
        perturbation_ids.append(perturbation_id)
    return perturbation_ids 

def sample_LLM_inputs(vertice_ids, perturbation_ids, sample_length=200):
    """
    vertice_ids: [int, int, ...] vertice ids
    perturbation_ids: [int, int, 'original-vertex'...] perturbation ids
    The above two lists are one to one mapping
    sample_length: the number of sentences to sample
    return: [int, int, ...] sampled vertice ids [int, int, 'original-vertex' ...] sampled perturbation ids
    """
    input_length = len(vertice_ids)
    if input_length <= sample_length:
        return vertice_ids, perturbation_ids
    
    # randomly select sample_length sentences
    sampled_indices = random.sample(range(input_length), sample_length)
    sampled_vertices = [vertice_ids[i] for i in sampled_indices]
    sampled_perturbation_ids = [perturbation_ids[i] for i in sampled_indices]

    return sampled_vertices, sampled_perturbation_ids


def from_vertices_to_LLM_input(vertices, labels, length=None): 
    if length is None:
        length = len(vertices)
    LLM_input_instances = []
    titles = ['word_id', 'word', 'sentence']
    rows = labels.iloc[vertices][titles].values.tolist()
    sample_rows = random.sample(rows, length) if len(rows) > length else rows
    for idx,row in enumerate(sample_rows): 
        sentence = row[2]
        word_id = row[0]
        word = row[1]
        sentence = ' '.join([f"[{word}]" if i == word_id-1 else word for i, word in enumerate(sentence.split())])
        LLM_input_instances.append({'word': word, 'sentence': sentence})
    return LLM_input_instances

def from_perturbation_to_LLM_input(perturbation_ids, labels, perturb_metadata):
    '''
    perturbation_ids: [int, int, 'original-vertex'...]
    labels: user-specific labels DataFrame
    perturb_metadata: user-specific perturbation metadata
    return: [{'word': word, 'sentence': sentence}, ...] 
    '''
    LLM_input_instances = []
    for perturbation_id in perturbation_ids:
        if isinstance(perturbation_id, str): # 'original-vertex'
            vertex = int(perturbation_id.split('-')[1])
            sentence = labels.iloc[vertex]['sentence']
            word = labels.iloc[vertex]['word']
            word_id = labels.iloc[vertex]['word_id']
            sentence = ' '.join([f"[{word}]" if i == word_id-1 else word for i, word in enumerate(sentence.split())])
            LLM_input_instances.append({'word': word, 'sentence': sentence})
        else:
            sentence = perturb_metadata.iloc[perturbation_id]['perturbed_sentence'] # [id, perturbed_sentence, p_id, v_id]
            match = re.search(r'\[(.*?)\]', sentence)
            if match:
                perturbed_focus_word = match.group(1)
                LLM_input_instances.append({'word': perturbed_focus_word, 'sentence': sentence})
            else:
                print('no match found for sentence:', sentence)
    return LLM_input_instances



