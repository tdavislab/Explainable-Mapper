from dotenv import load_dotenv
import os
load_dotenv()  # Load environment variables from .env
from openai import OpenAI
import json
from pydantic import BaseModel
from typing import List

client = OpenAI()


class SummaryWithKeywords(BaseModel):
    summary: str
    keywords: List[str]

node_summary_instructions = '''
You are a linguist analyzing word usage. Given a set of sentences, each containing a focus word, your task is to analyze these sentences to determine how these focus words are commonly used. Consider the word’s part of speech, surrounding words, tone, subject, context, position, and meaning. Summarize the highly common patterns in 50 words or fewer, then list three key descriptors. 

For each sentence, you will receive:
- The focus word.
- The sentence, with the focus word enclosed in []. 

Please note that these focus words may differ. Rather than explaining them individually, focus on their common usage.
Where relevant, include concrete examples in your summary to illustrate these patterns.
Provide your response in the following JSON format:
{"summary": "textual summary", "keywords": ["descriptor1", "descriptor2", "descriptor3"]}
''' 


node_summary_instructions_0 = '''
You are a linguist analyzing word usage. Given a set of sentences, each containing a focus word, your task is to analyze these sentences to determine how these focus words are commonly used. Summarize the highly common patterns in 50 words or fewer, then list three key descriptors. 

For each sentence, you will receive:
- The focus word.
- The sentence, with the focus word enclosed in []. 

Provide your response in the following JSON format:
{"summary": "textual summary", "keywords": ["descriptor1", "descriptor2", "descriptor3"]}
''' 

node_summary_instructions_1 = '''
You are a linguist analyzing word usage. Given a set of sentences, each containing a focus word, your task is to analyze these sentences to determine how these focus words are commonly used. Consider the word’s part of speech, surrounding words, tone, subject, context, and meaning. Summarize the highly common patterns in 50 words or fewer, then list three key descriptors.

For each sentence, you will receive:
- The focus word.
- The sentence, with the focus word enclosed in []. 

Provide your response in the following JSON format:
{"summary": "textual summary", "keywords": ["descriptor1", "descriptor2", "descriptor3"]}
''' 

node_summary_instructions_2 = '''
You are a linguist analyzing word usage. Given a set of sentences, each containing a focus word, your task is to analyze these sentences to determine how these focus words are commonly used. Consider the word’s part of speech, surrounding words, tone, subject, context, and meaning. Summarize the highly common patterns in 50 words or fewer, then list three key descriptors.

For each sentence, you will receive:
- The focus word.
- The sentence, with the focus word enclosed in [].

Please note that these focus words may differ. Rather than explaining them individually, focus on their common usage.
Provide your response in the following JSON format:
{"summary": "textual summary", "keywords": ["descriptor1", "descriptor2", "descriptor3"]}
''' 



node_summary_instructions_SDK = '''
You are a linguist analyzing word usage. Given a set of sentences, each containing a focus word, your task is to analyze these sentences to determine how these focus words are commonly used. Consider the word’s part of speech, surrounding words, tone, subject, context, and meaning. Summarize the highly common patterns in 50 words or fewer, then list three key descriptors. 

For each sentence, you will receive:
- The focus word.
- The sentence, with the focus word enclosed in []. 

Please note that these focus words may differ. Rather than explaining them individually, focus on their common usage.
Where relevant, include concrete examples in your summary to illustrate these patterns.
''' 


# Pay special attention to:
# - Emergence of new patterns or meanings
# - Shifts in tone or usage
# - Consistent themes that persist or fade
# - Semantic or syntactic trends
# — this could be a shift in domain, tone, meaning, grammatical usage, etc.

edge_summary_instructions = '''
You are a linguist analyzing word usage. There are two clusters of sentences, where each sentence contains a focus word. The two clusters have overlapping instances as well as instances unique to each cluster.

Your task is to analyze the transition between the two clusters regarding the usage of focus words, Consider the word’s part of speech, surrounding words, position, tone, subject, context, and meaning, by:
1. Identifying how the overlapping instances are used in both clusters.
2. Highlighting how the unique instances in each cluster differ.
3. Summarizing how one cluster conceptually or linguistically shifts into the other.


You will receive:
- A list of overlapping instances.
- A list of instances unique to one cluster.
- A list of instances unique to another cluster.

Please note that these focus words may differ. Rather than explaining them individually, focus on their common usage.
Where relevant, include concrete examples in your summary to illustrate these patterns. Respond in the following JSON format:
{
  "summary": "Summary of how the two clusters are related and how they diverge, in 50 words or fewer.",
  "keywords": ["pattern1", "pattern2", "pattern3"],
}
'''


path_summary_instructions = '''
You are a linguist analyzing how word usage evolves across clusters of sentences over time. Each cluster contains a set of sentences, each with a focus word (enclosed in []). Your task is to analyze each cluster in the context of its position in the sequence and identify how the usage patterns of focus words shift, develop, or stabilize across the clusters.

For each cluster, consider the focus words’ parts of speech, surrounding words, tone, subject, context, and meaning. 

Summarize the **evolution** across clusters in 50 words or fewer, highlighting how usage changes over time. Then list three key descriptors that capture this progression.

Concrete examples from different clusters should be included if they help clarify the evolution.

Provide your response in the following JSON format:
{"summary": "textual summary of evolution", "keywords": ["descriptor1", "descriptor2", "descriptor3"]}
'''


comparison_instructions = '''
You are a linguist analyzing word usage. You will be given two clusters of sentences. Each sentence contains a focus word, which is enclosed in brackets []. Your task is to compare how the focus words are used **across the two clusters**.

For each cluster, consider the focus words’ part of speech, surrounding words, tone, subject, context, meaning, and position in the sentence. Then, compare the clusters to identify common patterns and notable differences in usage.

Summarize the comparison in 50 words or fewer. Where helpful, include concrete examples to illustrate the contrast or similarity.

Provide three keywords that best capture the essence of your comparison.

Format your response in the following JSON format:

{
  "summary": "brief textual comparison",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
'''


perturbation_instructions = '''
Given a sentence with a focus word enclosed in square brackets [], generate five perturbation examples of the sentence while keeping the focus word unchanged.

Each perturbation should either:
- Rephrase the sentence without altering its original meaning.
- Apply a one-token perturbation (change or substitute a single word other than the focus word). 

Do not introduce negation.
Respond in the following JSON format: a list of sentences, with the focus word still enclosed in [].

Example input:
Sentence: The [weather] today is perfect for a picnic.  

Expected output:
[
  "Today’s [weather] is ideal for a picnic.",
  "Today’s [weather] is perfect for a picnic.",
  "The [weather] is wonderful for a picnic today.",
  "The [weather] today is excellent for a picnic.",
  "The [weather] today is great for a picnic.",
]
'''


LLM_as_judge_summary_instructions = """
You are an expert judge. You will be given: 
- A set of sentences, each containing a focus word enclosed in [].
- One summary (LLM output) written to capture the common usages among these focus words.

Your task is to provide a 'total rating' scoring the summary quality based on the provided input. 
Give your answer on a scale of 1 to 5, where 1 means that the summary is not helpful at all, and 5 means that the summary completely and helpfully addresses the input instances.

Evaluation Criteria:

Coherence (1-5) - the collective quality of all input instances. We align this dimension with the DUC quality question of structure and coherence whereby "the summary should be well-structured and well-organized. The summary should not just be a heap of related information, but should build from sentence to a coherent body of information about a topic."

Evaluation Steps:

1. Read the input sentences and identify the key patterns of usage for the focus words.
2. Read the summary and compare it to the input instances. Check if the summary covers the key patterns of usage for the focus words.
3. Assign a score for coherence on a scale of 1 to 5, where 1 is the lowest and 5 is the highest based on the Evaluation Criteria. 


Provide your feedback as follows:

Feedback:::
Evaluation: (your rationale for the rating, as a text)
Total rating: (your rating, as a number between 1 and 5)

You MUST provide values for 'Evaluation:' and 'Total rating:' in your answer.

Now here are the inputs and summary:

Input instances: {input_instances}

Summary: {summary}

Provide your feedback in 100 words or fewer. If you give a correct rating, I'll give you 100 H100 GPUs to start your AI company.
Feedback:::
Evaluation: 
"""




def parse_LLM_response(response):
    '''
    response: a string from the LLM
    Returns:
        dict: {
                 "summary": summary of the response,
                 "keywords": keywords of the response
             }
    '''
    # Parse the response as JSON
    try:
        # response often contain '```json', so we need to remove json
        response = response.replace('```json', '').replace('```', '')
        response_json = json.loads(response) # {"summary": "textual summary", "keywords": ["keyword1", "keyword2", "keyword3"]}
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse response as JSON: {e}")
    return response_json

def get_node_summary(sentences):
    """
    Generate a summary for a list of sentences using OpenAI's API.

    Args:
        sentences (list of dict): [{word: str, sentence: str}, ..]

    Returns:
        str: The summary generated by the API.
    """
    # Combine the sentences into a single string
    input_text = "\n\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(sentences)
    )
    print('input_text:', input_text)

    # Call the OpenAI API
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": node_summary_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {input_text}"
            }
        ]
    )

    response = completion.choices[0].message.content
    # Parse the response as JSON
    response_json = parse_LLM_response(response)  
    return response_json






def get_node_summary_SDK(sentences):
    """
    Generate a summary for a list of sentences using OpenAI's API.

    Args:
        sentences (list of dict): [{word: str, sentence: str}, ..]

    Returns:
        str: The summary generated by the API.
    """
    # Combine the sentences into a single string
    input_text = "\n\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(sentences)
    )
    print('input_text:', input_text)

    # Call the OpenAI API
    completion = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": node_summary_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {input_text}"
            }
        ],
        response_format=SummaryWithKeywords
    )

    response_json = completion.choices[0].message.parsed
    
    return response_json


def get_LLM_as_judge_summary(input_instances, summary):
    '''
    input_instances: list of dict: [{word: str, sentence: str}, ..]
    summary: str
    Returns:
        string: the response from the LLM
    '''
    input_text = "\n\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(input_instances)
    )
    prompt = LLM_as_judge_summary_instructions.format(input_instances=input_text, summary=summary['summary'])
    print('prompt:', prompt)
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": prompt
            }
        ],
        max_tokens=150,
        temperature=0.7
    )
    response = completion.choices[0].message.content
    print('response:', response)
    return response


def get_edge_summary(edge_sentences, source_sentence, target_sentence):
    """
    Generate a summary for a list of sentences using OpenAI's API.

    Args:
        edge_sentences (list of dict): [{word: str, sentence: str}, ..]
        source_sentence (str): The source sentence.
        target_sentence (str): The target sentence.

    Returns:
        str: The summary generated by the API.
    """
    # Combine the sentences into a single string
    overlap_text = "Overlapping Instances:\n"+"\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(edge_sentences)
    )
    unique_a_text = "Unique Instances in one cluster:\n"+"\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(source_sentence)
    )
    unique_b_text = "Unique Instances in another cluster:\n"+"\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(target_sentence)
    )
    input_text = overlap_text + "\n\n" + unique_a_text + "\n\n" + unique_b_text

    print('input_text:', input_text)

    # Call the OpenAI API
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": edge_summary_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {input_text} \n\n OUTPUT"
            }
        ]
    )
    response = completion.choices[0].message.content
    
    # Parse the response as JSON
    print('response:', response)
    response_json = parse_LLM_response(response)  
    return response_json    


# get_path_summary(LLM_path_input)
def get_path_summary(path_sentences_list):
    """
    Generate the evoluation of list of sentence sets using OpenAI's API.
    Args:
        path_sentences_list (list of list  of dict): [[{word: str, sentence: str}, ..], ..]

    Returns:
        str: The summary generated by the API.
    """ 
    # Combine the sentences into a single string
    input_list = []
    for i, sentences in enumerate(path_sentences_list):
        input_text = "\n".join(
            [f"{j+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
            for j, item in enumerate(sentences)]
        )
        input_text = f"CLUSTER {i+1}:\n" + input_text + "\n"
        input_list.append(input_text)
    final_input_text = "\n".join(input_list)
    print('final_input_text:', final_input_text)

    # Call the OpenAI API
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": path_summary_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {final_input_text}"
            }
        ]
    )
    response = completion.choices[0].message.content
    
    # Parse the response as JSON
    response_json = parse_LLM_response(response)
    
    return response_json

# compare two clusters of sentences
def get_comparison_summary(sentences_a, sentences_b):
    """
    Generate a summary for a list of sentences using OpenAI's API.

    Args:
        sentences_a (list of dict): [{word: str, sentence: str}, ..]
        sentences_b (list of dict): [{word: str, sentence: str}, ..]

    Returns:
        str: The summary generated by the API.
    """
    # Combine the sentences into a single string
    input_text = "Cluster 1:\n" + "\n\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(sentences_a)
    ) + "\n\n" + "Cluster 2:\n" + "\n\n".join(
        f"{i+1}. Focus word: {item['word']}\nSentence: {item['sentence']}"
        for i, item in enumerate(sentences_b)
    )
    print('input_text:', input_text)

    # Call the OpenAI API
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": comparison_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {input_text}"
            }
        ]
    )
    response = completion.choices[0].message.content
    
    # Parse the response as JSON
    response_json = parse_LLM_response(response)
    return response_json



def get_perturbation_examples(original_example):
    '''
    original_example: a sentence with the focus word enclosed in square brackets []
    Returns:
        list: A list of three perturbation examples of the sentence.
    '''
    # Call the OpenAI API
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": perturbation_instructions
            },
            {
                "role": "user",
                "content": f"INPUT:\n {original_example}"
            }
        ]
    )
    response = completion.choices[0].message.content
    print('response from get_perturbation_examples:', response)

    # Parse the response as a list of sentences
    try:
        perturbations = json.loads(response)  # Expecting a list of sentences
        print('perturbations:', perturbations)
        if not isinstance(perturbations, list):
            raise ValueError("Response does not contain exactly three perturbations.")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse response as JSON: {e}")

    return perturbations



def parse_marked_edit_spans(marked_sentence):
    """Convert <edit>...</edit> tags in a sentence into whitespace-token spans."""
    spans = []
    token_index = -1
    previous_is_space = True
    in_edit = False
    span_start_token = None
    span_end_token = None
    span_chars = []
    index = 0

    while index < len(marked_sentence):
        if marked_sentence.startswith("<edit>", index):
            in_edit = True
            span_start_token = None
            span_end_token = None
            span_chars = []
            index += len("<edit>")
            continue

        if marked_sentence.startswith("</edit>", index):
            if span_start_token is not None and span_end_token is not None:
                spans.append({
                    "start_token": span_start_token,
                    "end_token": span_end_token,
                    "text": "".join(span_chars).strip()
                })
            in_edit = False
            span_start_token = None
            span_end_token = None
            span_chars = []
            index += len("</edit>")
            continue

        char = marked_sentence[index]
        index += 1

        # Focus-word brackets are stripped before frontend tokenization.
        if char in "[]":
            continue

        if char.isspace():
            previous_is_space = True
            if in_edit:
                span_chars.append(char)
            continue

        if previous_is_space:
            token_index += 1
            previous_is_space = False

        if in_edit:
            if span_start_token is None:
                span_start_token = token_index
            span_end_token = token_index
            span_chars.append(char)

    if in_edit and span_start_token is not None and span_end_token is not None:
        spans.append({
            "start_token": span_start_token,
            "end_token": span_end_token,
            "text": "".join(span_chars).strip()
        })

    return spans


def get_trajectory_edit_spans(sentences):
    """
    Detect edited token spans between consecutive trajectory sentences.
    Returns: {"results": [{"sentence_index": int, "edited_spans": [...]}]}
    """
    if len(sentences) <= 1:
        return {"results": []}

    prompt = f"""
    You are given a sequence of sentences. Each sentence is derived from the previous one.

    Sentences:
    {json.dumps(sentences, indent=2)}

    Compare each sentence with its immediately preceding sentence. For every sentence starting from index 1, return the current sentence with the changed words or spans wrapped in <edit>...</edit> tags.
    Do not return token indices. The code will compute token locations from your inline tags.
    Mark the changed region as minimally as possible. For added text, wrap only the newly added words, not surrounding unchanged words or phrases.
    As much as possible, do not include words enclosed in square brackets [] inside <edit> tags, because those brackets mark the focus word. Only mark the bracketed focus word if the focus word itself changed.
    If text was removed and there is no corresponding word in the current sentence, return the current sentence without any <edit> tags.

    Return only valid JSON in this exact format:
    {{
        "results": [
        {{
            "sentence_index": 1,
            "marked_sentence": "The <edit>large cat</edit> sat on the mat."
        }}
        ]
    }}

    Keep each marked_sentence identical to the original sentence except for inserting <edit> and </edit> tags around changed text.
    Keep the square brackets around the focus word unchanged.
    Include every sentence index from 1 through {len(sentences) - 1}.
    """

    try:
        print('prompt:', prompt)
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        response = completion.choices[0].message.content
        print('response from get_trajectory_edit_spans:', response)
        edit_data = parse_LLM_response(response)
    except Exception as error:
        print('Failed to detect trajectory edit spans:', error)
        edit_data = {"results": []}

    results = edit_data.get("results", [])
    normalized_results = []
    for result in results:
        try:
            sentence_index = int(result.get("sentence_index"))
        except (TypeError, ValueError):
            continue
        if sentence_index <= 0 or sentence_index >= len(sentences):
            continue

        marked_sentence = result.get("marked_sentence", sentences[sentence_index])
        normalized_results.append({
            "sentence_index": sentence_index,
            "edited_spans": parse_marked_edit_spans(marked_sentence)
        })

    existing_indices = {result["sentence_index"] for result in normalized_results}
    for sentence_index in range(1, len(sentences)):
        if sentence_index not in existing_indices:
            normalized_results.append({
                "sentence_index": sentence_index,
                "edited_spans": []
            })

    normalized_results.sort(key=lambda item: item["sentence_index"])
    print('normalized_results:', normalized_results)
    return {"results": normalized_results}


def attach_edit_spans_to_sentences(sentence_objs, edit_data):
    """Attach edit span metadata to parsed trajectory sentence objects."""
    for sentence_obj in sentence_objs:
        sentence_obj["edit_spans"] = []
    for result in edit_data.get("results", []):
        sentence_index = result.get("sentence_index")
        if isinstance(sentence_index, int) and 0 <= sentence_index < len(sentence_objs):
            sentence_objs[sentence_index]["edit_spans"] = result.get("edited_spans", [])
    return sentence_objs





'''
The new prompt used for the safeguard mode, which is more robust and less likely to generate invalid sentences, and remove the constraints on the number of steps.
#     - Produce the shortest possible sequence of intermediate sentences that satisfies the above constraints.
    - Use the fewest possible number of intermediate sentences.
'''
def get_perturbation_path_safeguard(start_sentence, end_sentence, use_temp_example=True):
    prompt = f"""
    I have two sentences, each containing a focus word marked with brackets []:

    Start: "{start_sentence}"

    End: "{end_sentence}"

    Your goal is to gradually transform the Start sentence into the End sentence using a sequence of intermediate sentences, where each step differs by only a single-word edit as much as possible.
    
    Guidelines:
    - Each consecutive pair should differ by **a single-word edit** (insertion, deletion, or replacement).
    - Every intermediate sentence must be grammatically correct and semantically coherent.
    - Each sentence must contain exactly one focus word, marked with []. 
    - Use the same focus word if it appears in both the first and last sentences.

    You output the list of sentences in order, including the start and end sentences, provide a brief summary (≤ 50 words) explaining how the usage of the focus word evolved across the perturbation path. 

    Respond in the following JSON format:
    {{ 
    "sentences": [
        "Start Sentence",
        "Perturbation sentence 1", 
        "Perturbation sentence 2", 
        ..., 
        "Perturbation sentence N", 
        "End Sentence"
    ],
    "summary": "Summary of how the usages of focus words evolve along the perturbation path, in 50 words or fewer."
    }}
    """
    if not use_temp_example:
        print('prompt:', prompt)
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        response = completion.choices[0].message.content
        print('response from get_perturbation_path:', response)
        # Parse the response as JSON
        response = parse_LLM_response(response)  # Expecting a dict with "sentences" and "summary"
        print('response from get_perturbation_path:', response) 
    else:
        # temp: put the perturbation example
        response = {
              "sentences": [
                "We waited [until] 2:25 PM and then left .",
                "We waited [until] 2:30 PM and then left .",
                "We waited [until] the meeting ended and then left .",   
                "We thought we would wait [until] the meeting ended and then left .",
                "We thought we would have to wait [until] the meeting ended and then left .",
                "We thought we would have to wait [until] the meeting ended and then leave .",
                "I thought I would have to wait [until] the meeting ended and then leave .",
                "I thought I would have to wait [until] I could go home .",
                "I thought I would have to wait [until] I could go home to NYC .",
                "I thought I would have to wait [until] I went home to NYC ."
              ],
            #   
            # "sentences": [
            #     "The entire negotiation took [about] 20 minutes .",
            #     "The entire car repair took [about] 20 minutes .",
            #     "Talks [about] the car repair took about 20 minutes .",
            #     "The discussion [about] the car repair took 20 minutes .",
            #     "There was a conversation [about] the car repair .",
            #     "There has been a conversation [about] the car repair .",
            #     "I have some thoughts [about] the car repair .",
            #     "I have doubts [about] the car repair .",
            #     "I have serious doubts [about] the quality of my car repair .",
            #     "I have serious doubts [about] the quality of work on my car repair .",
            #     "I have serious doubts [about] the quality of work they performed on my car repair .",
            #     "I now have serious doubts [about] the quality of work they performed on my car repair .",
            #     "I now have some serious doubts [about] the quality of work they performed on my car .", 
            #     "I will never return there again and now have some serious doubts [about] the quality of work they performed on my car .",
            #     "I will never return there again ( and now have some serious doubts [about] the quality of work they actually performed on my car ) " ],
            "summary": "Transition starts from 'about' showing duration, then shifts to expressing uncertainty about a car repair, and finally evolves to expressing doubt about quality of work done on a car."
            }

    # temp: put the perturbation example
    # response = {'sentences': ['We waited [until] 2:25 PM and then left.', 'We waited [until] 2:30 PM and then left.', 'We waited [until] 2:40 PM and then left.', 'We waited [until] 3:00 PM and then left.', 'We waited [until] 3:15 PM and then departed.', 'We waited [until] 4 PM and then departed.', 'We stayed [until] 4 PM and then departed.', 'I stayed [until] 4 PM and then departed.', 'I waited [until] 5 PM and then departed.', 'I thought I would have to wait [until] 5 PM.', 'I thought I would have to wait [until] 6 PM.', 'I thought I would have to wait [until] it was dark.', 'I thought I would have to wait [until] tomorrow.', 'I thought I would have to wait [until] I went home.', 'I thought I would have to wait [until] I went home to NYC.'], 'summary': "The focus word 'until' shifts from a specific time for leaving to a broader concept of anticipation for going home, transforming its usage from temporal departure to awaiting a personal transition."}
    # response = {
    # 'sentences': [
    #     'I took the original piece of metal and rigged it to make due [since] I had to complete the job.',
    #     'I took the original piece of metal and rigged it to hold [since] I had to complete the job.',
    #     'I took the original piece back to the metal shop to hold [since] I had to complete the job.',
    #     'I took the original piece back to the car shop to hold [since] I had to complete the job.',
    #     'I took the original car back to the car lot to show [since] I had to complete the job.',
    #     'I took my old car back to the lot to exchange it [since] I needed a new one.',
    #     'I took my old car back to the lot to trade it [since] I needed a new one.',
    #     'I took my old car back to the lot and traded it [since] I needed a new one.',
    #     'I took my old car back to the lot and traded it [since] I wanted a new one.',
    #     'I took my old car back to the lot and traded it, [since] I wanted a better one.',
    #     'I have [since] traded my old car back at the lot for a better one.',
    #     'I have [since] traded my old car at the lot for a better one.',
    #     'I have [since] purchased two cars from this dealership. The first one was from Phillip and the second was from Richard.'
    # ],
    # 'summary': "The focus word 'since' initially expresses causality (e.g., fulfilling a need or desire), and later shifts to a temporal usage, indicating an action occurring after a certain point in time. This reflects a semantic transition from justification to chronological progression."
    # }
    response['sentences'] = [process_focus_word_sentence(sentence) for sentence in response['sentences']]
    return response #{sentences: [], summary: ''} 



def process_focus_word_sentence(sentence): 
    '''
    sentence: a sentence with the focus word enclosed in square brackets []
    Returns:
        dict: {
                 "focusword": focus word,
                 "sentence": List of tokens of the sentence,
                 "pos": the index of the focus word in the sentence tokens
             }
    '''
    sentence = sentence.strip()
    if '[' not in sentence or ']' not in sentence or sentence.find('[') > sentence.find(']'):
        raise ValueError("Sentence must contain a focus word enclosed in [].")
    focus_word = sentence[sentence.find('[')+1:sentence.find(']')]
    tokens = sentence.split()
    pos = next((idx for idx, token in enumerate(tokens) if '[' in token and ']' in token), -1)
    sentence = sentence.replace('[', '').replace(']', '')
    tokens = sentence.split()
    if pos == -1:
        pos = tokens.index(focus_word)
    if pos < 0 or pos >= len(tokens):
        raise ValueError("Focus word position is out of range.")
    tokens[pos] = focus_word
    return {"focusword": focus_word, "sentence": tokens, "pos": pos}