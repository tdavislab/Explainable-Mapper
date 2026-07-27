from sklearn.decomposition import PCA
from sklearn.manifold import TSNE, MDS
import umap
import pandas as pd
import numpy as np


class ProjectionProcessor:
  def __init__(self, data=None):
    """
    Initialize the ProjectionProcessor with optional data.
    :param data: Object of the raw_data class
    """
    self.data = data
    self.DR_method = None
    self.DR_result_cache = {'TSNE': None, 'PCA': None, 'UMAP': None, 'MDS': None}
    self.projection_setup = {}  # Stores DR_model, mean_x, mean_y

  def load_data(self, data):
    """
    Load the data and initialize caches.
    :param data: Object of the raw_data class
    """
    self.data = data
    self.DR_result_cache = {'TSNE': None, 'PCA': None, 'UMAP': None, 'MDS': None}
    self.projection_setup = {}
    self.DR_method = None

  def _build_dr_model(self, DR_method):
    if DR_method == 'TSNE':
      return TSNE(n_components=2, random_state=42, init='pca', learning_rate='auto')
    if DR_method == 'UMAP':
      # n_jobs=1 keeps the request deterministic and avoids OpenMP contention under Flask.
      return umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        metric='euclidean',
        random_state=42,
        n_jobs=1,
      )
    if DR_method == 'MDS':
      return MDS(n_components=2, random_state=42, dissimilarity='euclidean')
    if DR_method == 'PCA':
      return PCA(n_components=2)
    raise ValueError(f"Unsupported DR method: {DR_method}")

  def project(self, DR_method):
    """
    Perform dimensionality reduction using the specified method and cache the result.
    :param DR_method: String representing the dimensionality reduction method
    :return: 2D numpy array of the projection
    """
    if self.data is None:
      raise ValueError("Data is not loaded.")

    high_dim_data = np.asarray(self.data.get_original_activation_data(), dtype=float)
    if high_dim_data.ndim != 2 or high_dim_data.shape[0] == 0:
      raise ValueError("Activation data is empty or invalid.")
    if not np.isfinite(high_dim_data).all():
      raise ValueError("Activation data contains NaN or Inf values.")

    DR_model = self._build_dr_model(DR_method)

    # UMAP/TSNE/MDS should use fit_transform. Only PCA needs a separate transform API
    # for out-of-sample points (perturbation overlays).
    if DR_method == 'PCA':
      projection = DR_model.fit(high_dim_data).transform(high_dim_data)
    else:
      projection = DR_model.fit_transform(high_dim_data)

    projection = np.asarray(projection, dtype=float)
    if not np.isfinite(projection).all():
      raise ValueError(f"{DR_method} produced non-finite coordinates.")

    # Center the projection to (0, 0)
    mean_x, mean_y = np.mean(projection, axis=0)
    projection = projection - np.array([mean_x, mean_y])

    # Cache results
    self.DR_result_cache[DR_method] = projection
    self.projection_setup = {"DR_model": DR_model, "mean_x": float(mean_x), "mean_y": float(mean_y)}
    self.DR_method = DR_method

    return projection

  def get_projection_res(self, DR_method, labels, unique_label_list):
    """
    Get the projection and attributes for each point.
    :param DR_method: String representing the dimensionality reduction method
    :param labels: DataFrame containing labels
    :param unique_label_list: List of unique labels
    :return: list of projection point dicts
    """
    project_x_y = self.DR_result_cache.get(DR_method)
    if project_x_y is None or len(project_x_y) == 0:
      project_x_y = self.project(DR_method)

    n_samples = len(project_x_y)
    project_data = {
      'x': project_x_y[:, 0],
      'y': project_x_y[:, 1],
      'id': list(range(n_samples)),
      'L2Norm': self.data.get_normalized_l2_norms(),
      'label': labels['label'].apply(
        lambda x: x if x in unique_label_list else 'Others'
      ).tolist()
    }

    project_data_df = pd.DataFrame(project_data)
    self.DR_method = DR_method
    # Return native Python objects so Flask can jsonify reliably.
    return project_data_df.to_dict(orient='records')

  def get_perturb_project(self, embed_lst):
    """
    Return the DR results of the given embed_lst using the previous DR model.
    :param embed_lst: List of embeddings
    :return: 2D numpy array of the projection
    """
    DR_model = self.projection_setup.get("DR_model")
    if not DR_model:
      raise ValueError("No DR model found. Perform a projection first.")

    mean_x = self.projection_setup["mean_x"]
    mean_y = self.projection_setup["mean_y"]
    embed_lst = np.asarray(embed_lst, dtype=float)
    if hasattr(DR_model, 'transform'):
      projection = DR_model.transform(embed_lst)
    else:
      raise ValueError("Current DR model does not support out-of-sample transform.")
    projection = np.asarray(projection, dtype=float) - np.array([mean_x, mean_y])
    return projection

  def get_instance_project_xy(self, instance_id):
    """
    Return the x and y coordinates of the instance_id under the current projection.
    :param instance_id: Integer representing the instance ID
    :return: Tuple (x, y) of coordinates
    """
    if not self.DR_method:
      raise ValueError("No DR method has been applied yet.")

    current_project = self.DR_result_cache.get(self.DR_method)
    if current_project is None or len(current_project) == 0:
      raise ValueError("No projection found. There might be an async issue.")

    x, y = current_project[instance_id]
    return np.float64(x), np.float64(y)
