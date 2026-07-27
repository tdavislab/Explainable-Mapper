'''
construct a mapper graph using networkx
'''

import json
import networkx as nx
import numpy as np
import pandas as pd
import pickle
from scipy.spatial.distance import cdist

class GraphAnalysis:
    def __init__(self, raw_data_obj):
        self.raw_data_obj = raw_data_obj

    def load_graph(self, graph_data, eps_val):
        """{"nodes": [{"id": "1"..}, ...], "link": [{"source": 72, "target": 73},..]
        a node example: node {'id': 'cube1_cluster0', 'vertices': [3080, 3117, 283], 'labels': {'Locus': 15}, 'mean_L2Norm': 17.907749583232484}
        """
        self.G = nx.Graph()
        self.graph_data = graph_data
        self.eps_val = eps_val
        for edge in self.graph_data['links']:
            self.G.add_edge(edge['source'], edge['target']) 
        # Add all nodes to the graph (including isolated nodes)
        for node in self.graph_data['nodes']:
            if node['id'] not in self.G:
                self.G.add_node(node['id'])
        self.node_to_component = {} # key: node_id, value: component_id
        self.component_to_nodes = {}  # key: component_id, value: list of node_ids
        self.assign_component_ids()

        self.all_vertices = set()  # Initialize the attribute to store all vertices
        for node in self.graph_data['nodes']:
            self.all_vertices.update(node['vertices'])  # Add vertices from each node to the set
        self.all_vertices = list(self.all_vertices)
        self.all_node_idx = [node['id'] for node in self.graph_data['nodes']]
        
        # Build point-to-nodes mapping for perturbation validation
        self.point_to_nodes = {}  # {point_id: [node_id1, node_id2, ...]}
        self.node_l2_ranges = {}  # {node_id: (min_l2, max_l2)}
        for node in self.graph_data['nodes']:
            node_id = node['id']
            # Store L2 range for this node (prefer array field 'L2Norm_range' if available)
            if 'L2Norm_range' in node and isinstance(node['L2Norm_range'], (list, tuple)) and len(node['L2Norm_range']) == 2:
                min_l2 = float(node['L2Norm_range'][0])
                max_l2 = float(node['L2Norm_range'][1])
            else:
                min_l2 = float(node.get('min_L2Norm', 0))
                max_l2 = float(node.get('max_L2Norm', 1))
            # ensure ordering
            if min_l2 > max_l2:
                min_l2, max_l2 = max_l2, min_l2
            self.node_l2_ranges[node_id] = (min_l2, max_l2)
            # Map each point to this node
            for point_id in node['vertices']:
                if point_id not in self.point_to_nodes:
                    self.point_to_nodes[point_id] = []
                self.point_to_nodes[point_id].append(node_id)


    def load_perturb_data(self, perturb_embed_path, perturb_meta_path):
        '''load the perturbation data, including the embedding and metadata
        perturb_embed_path: .txt file, each line is the embedding of a perturbation
        perturb_meta_path: .pkl file, the metadata of the perturbations (dataframe: id, p_id, v_id, perturbed_sentence)
        ''' 
        # load the two file perturb_embed_path(numpy), perturb_meta_path(pandas)
        self.perturb_embeddings = np.loadtxt(perturb_embed_path)
        with open(perturb_meta_path, 'rb') as f:
            self.perturb_metadata = pickle.load(f)
        print('the shape of perturbation embeddings:', self.perturb_embeddings.shape)
        print('the number of perturbations:', len(self.perturb_metadata))

    
    def assign_component_ids(self):
        """Assign a component ID to each node in the graph and update graph_data."""
        # Get all connected components in the graph
        components = nx.connected_components(self.G)
        # Create a mapping of node to component ID
        self.node_to_component = {}
        for component_id, component in enumerate(components):
            self.component_to_nodes[component_id] = list(component)
            for node in component:
                self.node_to_component[node] = component_id
        # Add the component ID to each node in graph_data
        for node in self.graph_data['nodes']:
            node['comp_id'] = self.node_to_component[node['id']]
    

    def get_component(self, node):
        """Given a node, return its connected component."""
        # node = int(node)
        if node not in self.G:
            return -1
        component = nx.node_connected_component(self.G, node)
        return list(component)

    def shortest_path(self, node1, node2):
        """Given two nodes, return the shortest path between them."""
        # node1 = int(node1)
        # node2 = int(node2)
        if node1 not in self.G or node2 not in self.G:
            return -1
        try:
            path = nx.shortest_path(self.G, source=node1, target=node2)
            return path
        except nx.NetworkXNoPath:
            return -1

    def smallest_circle(self, node1, node2):
        """Given two nodes, return the smallest circle (cycle) that includes both nodes."""
        # node1 = int(node1)
        # node2 = int(node2)
        if node1 not in self.G or node2 not in self.G:
            return -1
        try:
            cycle_basis = nx.cycle_basis(self.G, root=node1)
            cycles = [cycle for cycle in cycle_basis if node1 in cycle and node2 in cycle]
            if not cycles:
                return -1
            smallest_cycle = min(cycles, key=len)
            return smallest_cycle
        except nx.NetworkXError:
            return -1
    
    def get_mapper_data(self, layout, project_obj=''):
        '''return the mapper graph data based on the layout
        layout: 'ForceDirected', 'AnchorCenter', 'AnchorReproject'
        project_obj: the correponding projection object
        '''
        graph_nodes = self.graph_data['nodes']
        if layout == 'ForceDirected':
            # delete the x y if already set
            if 'x' in graph_nodes[0]:
                for node in graph_nodes:
                    del node['x']
                    del node['y']
            return {'graph_data': self.graph_data, 'eps_val': self.eps_val}
        elif layout == 'AnchorCenter':
            for node in graph_nodes:
                vertices = node['vertices']
                closest_id = self.raw_data_obj.find_closest_to_center(vertices) 
                node['centerId'] = closest_id
                x, y = project_obj.get_instance_project_xy(closest_id)
                node['x'] = x
                node['y'] = y
            return {'graph_data': self.graph_data, 'eps_val': self.eps_val}
    
    def get_node_content(self, node_id): 
        '''Given a node_id, return the indexes in this node'''
        nodes = self.graph_data['nodes']
        selected_node = [node for node in nodes if node['id']==node_id][0]
        return selected_node['vertices']

    def get_edge_content(self, source_id, target_id):
        '''Given a source_id and target_id, return the indexes in the edge, and unique indexes in both nodes'''
        source_vertices = self.get_node_content(source_id)
        target_vertices = self.get_node_content(target_id)
        edge_vertices = list(set(source_vertices).intersection(target_vertices))
        unique_source_vertices = list(set(source_vertices) - set(edge_vertices))
        unique_target_vertices = list(set(target_vertices) - set(edge_vertices))
        return edge_vertices, unique_source_vertices, unique_target_vertices
    

    ### designed for mapper node attachment
    def get_all_vertices_in_graph(self):
        return self.all_vertices
    
    def get_nodes_containing_vertex(self, vertex_id):
        '''Given a vertex_id, return the list of node IDs that contain this vertex'''
        nodes = self.graph_data['nodes']
        containing_nodes = [node['id'] for node in nodes if vertex_id in node['vertices']]
        return containing_nodes
    
    def get_vertices_ids_in_nodes(self, node_ids): 
        vertices_ids_in_nodes = set()  # Initialize the attribute to store all vertices
        for node in self.graph_data['nodes']:
            if node['id'] in node_ids:
                vertices_ids_in_nodes.update(node['vertices'])  # Add vertices from each node to the set
        return list(vertices_ids_in_nodes)
    
    def get_all_node_ids(self):
        '''return all node ids in the graph'''
        return self.all_node_idx
    
    def validate_perturbation_l2_range(self, point_id, perturbation_embedding):
        '''
        Check if a perturbation embedding satisfies L2 range constraints for a point
        Args:
            point_id: Original point ID
            perturbation_embedding: Perturbation embedding array
        Returns:
            bool: True if perturbation satisfies all L2 range constraints
        '''
        if point_id not in self.point_to_nodes:
            return False  # Point not in any node
            
        perturbation_l2 = np.linalg.norm(perturbation_embedding)
        
        # Check if perturbation L2 norm falls within ALL nodes' ranges
        for node_id in self.point_to_nodes[point_id]:
            min_l2, max_l2 = self.node_l2_ranges[node_id]
            if not (min_l2 <= perturbation_l2 <= max_l2):
                return False  # Fails constraint for this node
        
        return True  # Satisfies all node L2 range constraints
    


# print('the number of all vertices in the graph:', len(self.all_vertices)) 
# for each mapper node, test if we can find the same number of perturbations
# missing_perturbation_per_node = []
# missing_perturbation_percentage_per_node = []
# for node in self.graph_data['nodes']:
#     vertices = node['vertices']
#     vertice_num = len(vertices)
#     perturb_num = 0 
#     vertices_embeddings = [self.raw_data_obj.get_instance_embedding(vertex, False) for vertex in vertices]
#     vertices_embeddings = np.array(vertices_embeddings) 

#     # check if the vertices belong to the same cluster
#     distances = cdist(vertices_embeddings, vertices_embeddings, metric='euclidean')
#     np.fill_diagonal(distances, np.nan)  # exclude self-distances
#     internal_avg_distance = np.nanmean(distances)
#     for vertex in vertices:
#         # find its five perturbations
#         perturb_embeds = self.perturb_embeddings[vertex*5: vertex*5+5]
#         distances = cdist(vertices_embeddings, perturb_embeds, metric='euclidean')
#         belong_to_cluster = [np.mean(cdist(vertices_embeddings, embedding.reshape(1, -1), metric='euclidean')) <= internal_avg_distance for embedding in perturb_embeds]
#         if sum(belong_to_cluster)>0:
#             perturb_num += 1
#         # if sum(belong_to_cluster) == 5:
#         #     print('this node has 5 perturbations')
#         #     print(f'this node has {len(vertices)} vertices')
#         #     for i in range(5):
#         #         print('perturbed sentence:', self.perturb_metadata.iloc[vertex*5+i]['perturbed_sentence'])

#     missing_perturbation_per_node.append(vertice_num - perturb_num)
#     missing_perturbation_percentage_per_node.append((vertice_num - perturb_num) / vertice_num)

# # Compute the statistics of the missing perturbations
# missing_perturbation_stats = {
#     'mean_missing': round(float(np.mean(missing_perturbation_per_node)), 2),
#     'std_missing': round(float(np.std(missing_perturbation_per_node)), 2),
#     'min_missing': round(float(np.min(missing_perturbation_per_node)), 2),
#     'max_missing': round(float(np.max(missing_perturbation_per_node)), 2)
# }

# missing_perturbation_percentage_stats = {
#     'mean_percentage': round(float(np.mean(missing_perturbation_percentage_per_node)), 2),
#     'std_percentage': round(float(np.std(missing_perturbation_percentage_per_node)), 2),
#     'min_percentage': round(float(np.min(missing_perturbation_percentage_per_node)), 2),
#     'max_percentage': round(float(np.max(missing_perturbation_percentage_per_node)), 2)
# }

# print("Missing Perturbation Statistics:", missing_perturbation_stats)
# print("Missing Perturbation Percentage Statistics:", missing_perturbation_percentage_stats)
