import json
import pandas as pd
import ast
from sklearn.neighbors import NearestNeighbors
import kneed
import numpy as np
import pickle
import torch
from sentence_transformers import SentenceTransformer, util
np.random.seed(42)

device = "mps" if torch.backends.mps.is_available() else "cpu"
sentence_encoder = SentenceTransformer('all-MiniLM-L6-v2', device=device)

CONSISTENCY_METRIC_COSINE = "cosine_similarity"
CONSISTENCY_METRIC_BERTSCORE = "bertscore"
CONSISTENCY_METRICS = {
    CONSISTENCY_METRIC_COSINE,
    CONSISTENCY_METRIC_BERTSCORE,
}

def sentence_similarity(sent1_dict, sent2_dict):
    """Compute cosine similarity between two sentences.
    """
    # stringfy the dict
    sent1 = json.dumps(sent1_dict)
    sent2 = json.dumps(sent2_dict)
    # Encode sentences to get their embeddings
    # embeddings1 = sentence_encoder.encode(sent1, convert_to_tensor=True)
    # embeddings2 = sentence_encoder.encode(sent2, convert_to_tensor=True)
    # # Compute cosine similarity
    # cosine_sim = util.pytorch_cos_sim(embeddings1, embeddings2)
    # Encode both sentences in one call

    embeddings = sentence_encoder.encode([sent1, sent2],convert_to_tensor=True,device=device, batch_size=2,
                                          normalize_embeddings=True)
    # Cosine-equivalent score on normalized embeddings
    cosine_sim = torch.dot(embeddings[0], embeddings[1]).item()
    return cosine_sim

def bertscore_similarity(sent1_dict, sent2_dict):
    """Compute BERTScore F1 between two explanation dictionaries."""
    from bert_score import score as bert_score

    sent1 = json.dumps(sent1_dict)
    sent2 = json.dumps(sent2_dict)
    _, _, f1 = bert_score([sent1], [sent2], lang="en", verbose=False)
    return f1[0].item()

def compute_consistency_score(sent1_dict, sent2_dict, metric=CONSISTENCY_METRIC_COSINE):
    """Compute consistency using the selected metric."""
    if metric == CONSISTENCY_METRIC_COSINE:
        return sentence_similarity(sent1_dict, sent2_dict)
    if metric == CONSISTENCY_METRIC_BERTSCORE:
        return bertscore_similarity(sent1_dict, sent2_dict)
    raise ValueError(f"Unsupported consistency metric: {metric}")

def load_json(path):
    with open(path, 'r') as file:
        data = json.load(file)
        return data

def load_pickle(path):
  with open(path, 'rb') as file:
    data = pickle.load(file)
    return data

def process_topobert_metadata(metadata_path, sentence_path, name=None): 
    # return the metadata dataframe for topobert_data, process the original metadata and merge with the sentence data
    metadata = []
    if name in ['ss-role']:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            for line in f:
                word_info, word_label = line.strip().split('\t')
                sent_info, word = word_info.split(':', 1) # handle cases like: (258, 11):: 	 p.PUNCT
                word = word.strip()
                sent_info = ast.literal_eval(sent_info)
                word_label = word_label[3:]
                metadata.append([sent_info[0], sent_info[1], word, word_label])
        metadata = pd.DataFrame(metadata, columns=['sent_id', 'word_id', 'word', 'label'])
        with open(sentence_path, 'r', encoding='utf-8') as sent_file:
            sent_data = json.load(sent_file)
        metadata['sentence'] = metadata['sent_id'].apply(lambda x: sent_data[str(x)])
    else:
        raise ValueError('Dataset not supported')
    metadata['idx'] = range(len(metadata))
    return metadata


def elbow_eps(data, n_neighbors, use_elbow_way=True): 
    subsample_size = 1000000000  # 1000-10000 is usually enough for elbow estimation
    # Randomly select indices
    if data.shape[0] > subsample_size:
        idx = np.random.choice(data.shape[0], subsample_size, replace=False)
        data_sub = data[idx]
    else:
        data_sub = data
    
    if use_elbow_way:   # use the elbow way
        nbrs = NearestNeighbors(n_neighbors=n_neighbors).fit(data_sub) # n_neighbors is the number of neighbors to consider for the k-nearest neighbors search
        distances, indices = nbrs.kneighbors(data_sub) # the closest neighbor of one point is the point itself
        distances = np.sort(distances, axis=0)[::-1]
        kneedle = kneed.KneeLocator(distances[:, 1], np.arange(len(distances[:, n_neighbors-1])), curve='convex', direction='decreasing')
        eps = kneedle.knee
    else:
        # use the percentile way    
        nn = NearestNeighbors(n_neighbors=n_neighbors, metric='euclidean').fit(data_sub)
        dists, _ = nn.kneighbors(data_sub)
        k_dists = np.sort(dists[:, -1])  # distance to k-th neighbor
        q = 0.5                              # try 0.80–0.90
        eps = float(np.quantile(k_dists, q))   # smaller than the “big elbow” 
    return eps

def elbow_eps_raw(data, minPts, label, color, subsample_size=10000):
    # sample 10000 points from the data, used for draw the elbow chart
    if data.shape[0] > subsample_size:
        idx = np.random.choice(data.shape[0], subsample_size, replace=False)
        data_sub = data[idx]
    else:
        data_sub = data
    nbrs = NearestNeighbors(n_neighbors=minPts).fit(data_sub)
    distances, indices = nbrs.kneighbors(data_sub) # distance: narray [n*minPts]
    distances = np.sort(distances, axis=0)
    distances = distances[:, -1]  
    chart_data = {
                'label': label,
                'data': distances.tolist(),
                'fill': False,
                'borderColor': color,
                'tension': 0.1,
            }
    return chart_data