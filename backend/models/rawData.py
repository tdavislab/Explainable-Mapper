import pandas as pd
import numpy as np
from scipy.spatial.distance import pdist


class RawDataProcesser:
  def __init__(self):
    """
    Initialize the RawDataProcessor with no data loaded.
    the embedding data
    """
    self.activation = [] # 2d numpy array
    self.center = None
    self.scale = None
    self.normalized_l2_norms = []  # Array to store normalized L2 norms (0-1)

  def load_activation_data(self, activation): 
    """
    Load activation data and normalize it into a shared coordinate system.
    Args:
        activation (np.ndarray): Raw activation data (2D array).
    """
    activation = np.asarray(activation, dtype=float)
    self.center = activation.mean(axis=0)
    centered_activation = activation - self.center
    pairwise_distances = pdist(centered_activation, metric='euclidean')
    self.scale = pairwise_distances.max() if len(pairwise_distances) > 0 else 0
    if self.scale == 0:
      self.scale = 1
    self.activation = centered_activation / self.scale
    self.l2_norms = np.linalg.norm(self.activation, axis=1)
    l2_range = self.l2_norms.max() - self.l2_norms.min()
    if l2_range == 0:
      self.normalized_l2_norms = np.zeros_like(self.l2_norms)
    else:
      self.normalized_l2_norms = (self.l2_norms - self.l2_norms.min()) / l2_range

  def transform_embeddings(self, embeddings):
    """
    Apply the activation-derived centering and scaling to related embeddings.
    """
    if self.center is None or self.scale is None:
      raise ValueError("Activation normalization parameters are not initialized.")
    embeddings = np.asarray(embeddings, dtype=float)
    return (embeddings - self.center) / self.scale

  def get_original_activation_data(self):
    return self.activation 

  def get_instance_embedding(self, instance_id):
    """
    Retrieve the embedding for a given instance ID.
    Args: instance_id (int): Instance index.
    Returns: np.ndarray: Embedding as a 1D array.
    """
    return self.activation[instance_id]

  def get_normalized_l2_norms(self):
     return list(self.normalized_l2_norms)

  def get_original_l2_norms(self):
    return self.l2_norms
  
  def find_closest_to_center(self, vertices_lst):
    """
    Find the ID of the instance closest to the center of the given vertices.
    Args:
        vertices_lst (list[int]): List of vertex indices.
    Returns:
        int: Index of the instance closest to the center.
    """
    subset = self.activation[vertices_lst]
    center = subset.mean(axis=0)
    distances = np.linalg.norm(subset - center, axis=1)
    closest_id = vertices_lst[np.argmin(distances)]
    return closest_id

  def compute_center(self, vertices_lst):
    """
    Compute the center of the given vertices.
    Args:
        vertices_lst (list[int]): List of vertex indices.
    Returns:
        np.ndarray: Center of the vertices as a 1D array.
    """
    subset = self.activation[vertices_lst]
    center = subset.mean(axis=0)
    return center

  def calculate_mean_L2_norm(self, id_lst, metric="mean"):
    """
      Calculate the L2 norm for a given cluster of instances based on the specified metric.
      Args:
          id_lst (list[int]): List of instance indices.
          metric (str): Metric to calculate ("mean", "max", "min").
      Returns:
          float: Calculated L2 norm based on the specified metric.
    """
    cluster_l2_norms = self.normalized_l2_norms[id_lst]
    # Calculate the metric
    if metric == "mean":
        return cluster_l2_norms.mean()
    elif metric == "max":
        return cluster_l2_norms.max()
    elif metric == "min":
        return cluster_l2_norms.min()
    else:
        raise ValueError(f"Unsupported metric: {metric}. Supported metrics are 'mean', 'max', and 'min'.")