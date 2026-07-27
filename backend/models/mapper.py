'''
run the mapper graph for ball mapper and classical mapper
'''
import kmapper as km
import pickle
import pandas as pd
import numpy as np
from scipy.spatial.distance import pdist
from sklearn.cluster import DBSCAN
from networkx.readwrite import json_graph
from utils import elbow_eps
from pyballmapper import BallMapper


class ClassicalMapper:
    def __init__(self):
        """
        Initialize the ClassicalMapper class.
        """
        self.mapper = None
        self.cover_obj = None
        self.activations_obj = None
        self.cover_strategy = 'uniform'
        self.l2_norms = None

    def create_mapper(self, activations_obj, cover_val, overlap_val, eps_val, minPts_val, 
        label_df, unique_label_list, use_automatic_eps=True, cover_strategy='uniform', 
        use_elbow_way=True):
        """
        Create a mapper graph using KeplerMapper.
        Parameters:
            activations_obj: Object containing activation data and related methods.
            cover_val: Number of intervals for the cover.
            overlap_val: Overlap percentage for the cover.
            eps_val: Epsilon value for DBSCAN clustering.
            minPts_val: Minimum points for DBSCAN clustering.
            label_df: DataFrame containing labels for the data points.
            unique_label_list: List of unique labels to consider.
            use_automatic_eps: Whether to calculate epsilon automatically using elbow method.
            cover_strategy: 'uniform' for standard even-width cover on L2 lens; 'quantile' for density-based cover with roughly equal counts per interval.

        Returns:
            A JSON representation of the mapper graph.
        """
        # Initialize mapper and cover
        self.mapper = km.KeplerMapper(verbose=0)
        self.cover_obj = km.Cover(n_cubes=cover_val, perc_overlap=overlap_val) 
        self.activations_obj = activations_obj
        self.cover_strategy = cover_strategy

        # Retrieve activation data
        activations = self.activations_obj.get_original_activation_data()
        self.l2_norms = np.linalg.norm(activations, axis=1)
        # Automatically calculate epsilon if required
        if use_automatic_eps:
            eps_val = elbow_eps(activations, minPts_val, use_elbow_way=use_elbow_way)
        print(f'The eps_val is {eps_val}')       

        # Prepare lens / projected data
        # Standard: use KeplerMapper's l2norm lens. Quantile: use ranked L2 norms (uniform [0,1]) to equalize density per cube.
        if cover_strategy == 'quantile':
            # Compute L2 norms
            l2_norms = self.l2_norms
            n_samples = len(l2_norms)
            # Stable ranking to obtain approximate empirical CDF values in (0,1)
            sorted_idx = np.argsort(l2_norms, kind='mergesort')
            ranks = np.empty(n_samples, dtype=float)
            ranks[sorted_idx] = np.arange(1, n_samples + 1, dtype=float)
            lens_uniform = ranks / (n_samples + 1.0)
            projected_data = lens_uniform.reshape(-1, 1)
        else:
            projected_data = self.mapper.fit_transform(activations, projection='l2norm', scaler=None)
        print('the current projected data is:', projected_data)

        # Create the mapper graph
        graph = self.mapper.map(
            projected_data,
            activations,
            # in DBSCAN, the min_samples includes the point itself
            clusterer=DBSCAN(eps=eps_val, metric='euclidean', min_samples=minPts_val),
            cover=self.cover_obj,
            remove_duplicate_nodes=True
        )
        # get the cover centers and radius
        cover_centers = self.cover_obj.centers_ # [array([10.88597347], ..]
        cover_radius = self.cover_obj.radius_[0] # [10.88597347]=>10.88597347
        print('the current cover centers are:', cover_centers)
        print('the current cover radius is:', cover_radius)
  
        # Convert to NetworkX graph and then to JSON
        nx_graph = km.adapter.to_networkx(graph)
        js_graph = json_graph.node_link_data(nx_graph)

        # Process nodes
        for node in js_graph['nodes']:
            node_id  = node['id'] # "cube47_cluster3" cube id = 47
            cube_id = int(node_id.split('_')[0][4:])
            cube_center = cover_centers[cube_id][0]
            # TODO: the range just need to store once for each cube id (some nodes have the same cube id)
            if cover_strategy == 'quantile':
                # Map uniformized interval bounds back to original L2 space via quantiles
                p_left = max(0.0, float(cube_center - cover_radius))
                p_right = min(1.0, float(cube_center + cover_radius))
                l2_left = np.quantile(self.l2_norms, p_left)
                l2_right = np.quantile(self.l2_norms, p_right)
                node['L2Norm_range'] = [float(l2_left), float(l2_right)]
            else:
                node['L2Norm_range'] = [float(cube_center - cover_radius), float(cube_center + cover_radius)]
            node['vertices'] = node.pop('membership')
            node['labels'] = get_node_label_composition(node['vertices'], label_df, unique_label_list)
            node['mean_L2Norm'] = self.activations_obj.calculate_mean_L2_norm(node['vertices'], metric='mean')

        # Process links
        for link in js_graph['links']:
            source_node = nx_graph.nodes[link['source']]
            target_node = nx_graph.nodes[link['target']]
            source_vertices = set(source_node['membership'])
            target_vertices = set(target_node['membership'])
            intersection = len(source_vertices.intersection(target_vertices))
            union = len(source_vertices.union(target_vertices))
            jacard_similarity = intersection / union
            link['jcd_sim'] = jacard_similarity

        # Construct final JSON graph
        new_graph_json = {'nodes': js_graph['nodes'], 'links': js_graph['links']}

        return new_graph_json, eps_val
    
    def get_cube_id(self, embedding):
        """
        Return cube IDs whose cover interval contains the embedding's lens value.
        For quantile covers, map raw L2 into the same empirical-CDF lens used at build time.
        """
        if self.cover_obj is None:
            raise ValueError("Mapper cover has not been initialized.")

        raw_l2 = float(np.linalg.norm(embedding))
        if self.cover_strategy == 'quantile':
            if self.l2_norms is None or len(self.l2_norms) == 0:
                raise ValueError("Quantile cover requires stored L2 norms.")
            # Empirical CDF / mid-rank in (0, 1), matching create_mapper.
            n_samples = len(self.l2_norms)
            rank = np.searchsorted(np.sort(self.l2_norms), raw_l2, side='left') + 1
            lens_value = rank / (n_samples + 1.0)
        else:
            lens_value = raw_l2

        cube_ids = []
        radius = self.cover_obj.radius_[0]
        for cube_id, center in enumerate(self.cover_obj.centers_):
            center_value = center[0]
            if center_value - radius <= lens_value <= center_value + radius:
                cube_ids.append(cube_id)
        return cube_ids

def get_node_label_composition(row_indices, label_df, unique_label_list):
    filtered_df = label_df.iloc[row_indices].copy()
    # filtered_df = label_df[label_df['idx'].isin(row_indices)]
    filtered_df['label'] = filtered_df['label'].apply(lambda x: x if x in unique_label_list else 'Others')
    statistics_dict = filtered_df['label'].value_counts().to_dict()
    return statistics_dict

def create_ball_mapper(data_obj, 
                  eps_val,
                  label_df,
                  unique_label_list):
    activations = data_obj.get_original_activation_data()
    print(f'The eps_val is {eps_val}')
    print(f'The activations shape is {activations.shape}')
    bm = BallMapper(X = activations, eps = eps_val)
    js_graph = json_graph.node_link_data(bm.Graph)
    for node in js_graph['nodes']:
        node['vertices'] = node.pop('points covered').tolist()
        node['id'] = f"node_{node['id']}"
        node.pop('size')
        node.pop('landmark')
        node['labels'] = get_node_label_composition(node['vertices'], label_df, unique_label_list)
    for link in js_graph['links']:
        link['source'] = f"node_{link['source']}"
        link['target'] = f"node_{link['target']}"
    new_graph_json = {'nodes': js_graph['nodes'], 'links': js_graph['links']}
    return new_graph_json, eps_val