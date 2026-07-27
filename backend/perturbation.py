from explanationAgents import get_perturbation_examples
from models.embeddingGeneration import BERTEmbeddingExtractor
import os
import re
import numpy as np
from scipy.spatial.distance import cdist


_extractor_cache = {}

# Fallback HuggingFace ids when a local fine-tuned checkpoint is unavailable.
_HF_MODEL_FALLBACKS = {
    'BertBase': 'bert-base-uncased',
    'FT_BertBase': 'bert-base-uncased',
    'ModernBERT': 'answerdotai/ModernBERT-base',
    'FT_Roberta': 'roberta-base',
    'RobertaBase': 'roberta-base',
}


def _extractor_model_name(model_name: str) -> str:
    if 'roberta' in (model_name or '').lower():
        return 'RobertaBase'
    return 'BertBase'


def resolve_model_checkpoint(user_instances: dict) -> str:
    """Resolve a local checkpoint path or HuggingFace model id for the active dataset."""
    paths = user_instances.get('PATHS') or {}
    dataset_name = user_instances.get('DATASET_NAME')
    name = user_instances.get('NAME')
    model_name = user_instances.get('MODEL_NAME')

    template = paths.get('MODEL_CHECKPOINT_PATH')
    if template:
        try:
            candidate = template.format(
                DATASET_NAME=dataset_name,
                NAME=name,
                MODEL_NAME=model_name
            )
        except Exception:
            candidate = None
        if candidate:
            if os.path.exists(candidate) or not candidate.startswith('.'):
                return candidate

    # TopoBERT local fine-tuned checkpoints
    if dataset_name == 'topobert_data' and name and model_name:
        local_path = f'./data/{dataset_name}/{name}/{model_name}/models/checkpoint-413'
        if os.path.exists(local_path):
            return local_path

    fallback = _HF_MODEL_FALLBACKS.get(model_name)
    if fallback:
        print(f"[embed] No local checkpoint for {model_name}; using HuggingFace model {fallback}")
        return fallback

    raise FileNotFoundError(
        f"No embedding model configured for dataset={dataset_name}, model={model_name}"
    )


def get_embed_extractor(user_instances: dict):
    model_path = resolve_model_checkpoint(user_instances)
    model_name = _extractor_model_name(user_instances.get('MODEL_NAME', 'BertBase'))
    cache_key = (model_path, model_name)
    if cache_key not in _extractor_cache:
        _extractor_cache[cache_key] = BERTEmbeddingExtractor(model_path, model_name=model_name)
    return _extractor_cache[cache_key]


def get_perturbation_LLM_inputs(original_examples, cluster_embeddings, user_instances=None, layer=12):
    '''
    original_examples: [{'word': word, 'sentence': sentence}, ..]
    for each example, returns a list of three perturbation examples of the sentence. 
    cluster_embeddings: np.ndarray, shape (n_samples, n_features)
    '''
    if user_instances is None:
        raise ValueError("user_instances is required to resolve the embedding model")

    embed_extractor = get_embed_extractor(user_instances)
    layer = int(user_instances.get('current_layer', layer) or layer)

    perturbation_inputs = []
    for example in original_examples:
        sentence = example['sentence']
        perturbations = get_perturbation_examples(sentence)
        perturbation_inputs.extend(perturbations)

    parsed_perturbation_inputs = []
    for idx, perturbation in enumerate(perturbation_inputs):
        parsed_perturbation = parse_focus_sentence(perturbation, idx)
        parsed_perturbation_inputs.append(parsed_perturbation)

    perturbed_embeddings = []
    for perturbation in parsed_perturbation_inputs:
        focus_word_embedding = embed_extractor.get_focus_word_embedding(
            perturbation['toks'], perturbation['pos'], perturbation['focus'], layer=layer
        )
        perturbed_embeddings.append(focus_word_embedding)

    distances = cdist(cluster_embeddings, cluster_embeddings, metric='euclidean')
    np.fill_diagonal(distances, np.nan)
    internal_avg_distance = np.nanmean(distances)
    threshold = internal_avg_distance
    belong_to_cluster = [
        np.mean(cdist(cluster_embeddings, embedding.reshape(1, -1), metric='euclidean')) <= threshold
        for embedding in perturbed_embeddings
    ]
    belong_percentage = f'{sum(belong_to_cluster)} / {len(belong_to_cluster)}'

    filtered_pairs = [
        (perturbation_inputs[i], parsed_perturbation_inputs[i])
        for i in range(len(perturbation_inputs))
        if belong_to_cluster[i]
    ]
    perturbation_inputs = [pair[0] for pair in filtered_pairs]
    parsed_perturbation_inputs = [pair[1] for pair in filtered_pairs]

    LLM_inputs = [
        {'word': parsed['focus'], 'sentence': sentence}
        for sentence, parsed in zip(perturbation_inputs, parsed_perturbation_inputs)
    ]
    final_LLM_inputs = np.random.choice(LLM_inputs, 15, replace=False) if len(LLM_inputs) > 15 else LLM_inputs
    return final_LLM_inputs, perturbation_inputs, belong_percentage


def parse_focus_sentence(sentence, idx=0):
    match = re.search(r'\[(.*?)\]', sentence)
    if not match:
        raise ValueError("No focus word found in brackets.")
    focus_word = match.group(1)
    clean_sentence = sentence.replace(f'[{focus_word}]', " "+focus_word+" ")
    tokens = clean_sentence.strip().split()
    try:
        focus_pos = tokens.index(focus_word)
    except ValueError:
        raise ValueError("Focus word not found in tokenized sentence.")

    return {
        "id": idx,
        "toks": tokens,
        "focus": focus_word,
        "pos": focus_pos
    }


def generate_embeddings(perturbation, user_instances=None, layer=None):
    '''
    perturbation:  {"focusword": focus_word, "sentence": sentence, "pos": pos}
    '''
    if user_instances is None:
        raise ValueError("user_instances is required to resolve the embedding model")
    embed_extractor = get_embed_extractor(user_instances)
    layer = int(layer if layer is not None else user_instances.get('current_layer') or 12)
    return embed_extractor.get_focus_word_embedding(
        perturbation['sentence'],
        perturbation['pos'],
        perturbation['focusword'],
        layer=layer
    )
