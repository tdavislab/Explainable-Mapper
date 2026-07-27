from flask import Blueprint, request, jsonify, session
from user_manager import get_user_data


select_detail_routes = Blueprint('select_detail_routes', __name__)


################################# Update the table ########################################
@select_detail_routes.route('/selected_table_details', methods=('GET', 'POST'))
def get_selected_details(): 
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    metadata = user_instances['metadata']
    response_data = request.get_json()
    selectedInstancesObj = response_data['selectedInstancesObj'] # {instances: [int, int, ...], startId: 'manual'}
    vertices = selectedInstancesObj['instances']
    start_id = selectedInstancesObj['startId']
    titles = ['idx', 'word_id', 'word', 'label', 'sentence']
    if start_id == 'mapper-edge':
        nodePair = selectedInstancesObj['nodePair']
        edge_vertices, unique_source_vertices, unique_target_vertices = mapper_graph.get_edge_content(nodePair[0], nodePair[1])
        rows = metadata.iloc[edge_vertices][titles].values.tolist()
        source_rows = metadata.iloc[unique_source_vertices][titles].values.tolist()
        target_rows = metadata.iloc[unique_target_vertices][titles].values.tolist()
        return {'titles': titles, 'rows': rows, 'source_rows': source_rows, 'target_rows': target_rows}
    else:
        rows = metadata.iloc[vertices][titles].values.tolist()
        return {'titles': titles, 'rows': rows}

    
@select_detail_routes.route('/comparison_table_details', methods=('GET', 'POST'))
def get_comparison_table_details(): 
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    metadata = user_instances['metadata']
    response_data = request.get_json()
    comparisonInstances = response_data['comparisonInstances'] # [node id 1, node id 2, ...]
    vertices = mapper_graph.get_vertices_ids_in_nodes(comparisonInstances)
    titles = ['idx', 'word_id', 'word', 'label', 'sentence']
    rows = metadata.iloc[vertices][titles].values.tolist()
    return {'titles': titles, 'rows': rows}
################################# Update the table End ########################################



################################# Bar chart distribution ########################################
@select_detail_routes.route('/selected_distribution', methods=('POST',))
def get_selected_distribution():
    """Get the distribution of selected instances based on a specific attribute for rendering bar chart"""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    metadata = user_instances['metadata']
    response_data = request.get_json()
    distribution_attr = response_data.get('distributionAttr')  # Attribute to distribute by: top-tokens, top-labels ('word', 'label'])
    selected_instances = response_data.get('selectedInstances')  # Selected instance IDs
    distribution_attr = 'word' if distribution_attr == 'top-tokens' else user_instances.get('CATEGORY_ATTRIBUTE', 'label')
    # Filter the metadata DataFrame based on selected instances
    filtered_df = metadata[metadata.index.isin(selected_instances['instances'])]
    # Calculate the distribution based on the specified attribute
    distribution = filtered_df[distribution_attr].value_counts().to_dict()
    max_length = 10
    # Prepare the response
    # Limit the distribution to the top `max_length` items
    sorted_distribution = sorted(distribution.items(), key=lambda x: x[1], reverse=True)[:max_length]
    response = {
        "labels": [item[0] for item in sorted_distribution],
        "data": [item[1] for item in sorted_distribution]
    }
    return jsonify(response)

@select_detail_routes.route('/comparison_distribution', methods=('POST',))
def get_comparison_distribution():
    """Get the distribution of selected instances based on a specific attribute for rendering bar chart"""
    user_id = session['user_id']
    user_instances = get_user_data(user_id)
    mapper_graph = user_instances['mapper_graph']
    metadata = user_instances['metadata']
    response_data = request.get_json()
    distribution_attr = response_data.get('distributionAttr')  # Attribute to distribute by: top-tokens, top-labels ('word', 'label'])
    selected_node_id_lst = response_data.get('selectedNodeIdLst')  # Selected nodes IDs
    vertex_ids = mapper_graph.get_vertices_ids_in_nodes(selected_node_id_lst)

    distribution_attr = 'word' if distribution_attr == 'top-tokens' else user_instances.get('CATEGORY_ATTRIBUTE', 'label')
    # Filter the metadata DataFrame based on selected instances
    filtered_df = metadata[metadata.index.isin(vertex_ids)]
    # Calculate the distribution based on the specified attribute
    distribution = filtered_df[distribution_attr].value_counts().to_dict()
    max_length = 10
    # Prepare the response
    # Limit the distribution to the top `max_length` items
    sorted_distribution = sorted(distribution.items(), key=lambda x: x[1], reverse=True)[:max_length]
    response = {
        "labels": [item[0] for item in sorted_distribution],
        "data": [item[1] for item in sorted_distribution]
    }
    return jsonify(response)

################################# Bar chart distribution End ########################################
