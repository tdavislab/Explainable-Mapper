import torch
import os
from transformers import (
    AutoTokenizer,
    AutoModel
)
import os
from os.path import join as jo
import json
import pickle

## load the model and get focus word embed
class BERTEmbeddingExtractor:
    def __init__(self, model_path, model_name, device=None):
        """        
        Args:
            model_path (str): path to the fine-tuned models
            model_name: 
            device (torch.device): GPU or CPU device
        """
        self.device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
        print(f"Device set to: {self.device}")
        self.model_name = model_name
        self.model_path = model_path
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path, add_prefix_space=(model_name == 'RobertaBase') # Roberta requires this para to be true
        )
        self.model = AutoModel.from_pretrained(model_path).to(self.device)

        self.layers = self.model.config.num_hidden_layers+1
        print(f"Number of layers: {self.layers}")

        self.model.eval()  # Set to evaluation mode
    
    def get_focus_word_embedding(self, sentence, focus_word_id, focus_word, layer):
        """
        Extract the focus word embedding at the given layer
        Args:
            sentence': [tok1, tok2, ]
            layer: num
            focus_word_id: int
            focus_word: string
        Returns:
            1d numpy array: word embed 
        """
        assert sentence[focus_word_id] == focus_word, \
            f"The focus words has a wrong word id"
        print('the current model name is:', self.model_name)
        print('the current model path is:', self.model_path)
        print('the current sentence is:', sentence)
        print('the current focus word id is:', focus_word_id)
        print('the current focus word is:', focus_word)
        # Tokenize the sentence
        encoded = self.tokenizer(sentence, is_split_into_words=True, 
                                    return_tensors='pt', 
                                    padding=True, 
                                    truncation=True)
        # Move to GPU
        input_ids = encoded['input_ids'].to(self.device)
        attention_mask = encoded['attention_mask'].to(self.device) 

        with torch.no_grad():
            outputs = self.model(input_ids,
                                attention_mask=attention_mask,
                                output_hidden_states=True)
            hidden_states = outputs.hidden_states   #  (num_layers, batch_size, seq_len, hidden_size)

            # Get word-level tokens and map back to original tokens
            word_ids = encoded.word_ids(0)
            print('word_ids:', word_ids)

            # Collect embeddings for original tokens
            for i, word_idx in enumerate(word_ids):
                # Skip special tokens (None) and handle first subword of each word
                if word_idx == focus_word_id: 
                    embedding = hidden_states[layer][0][i].cpu().numpy()
                    return embedding
    