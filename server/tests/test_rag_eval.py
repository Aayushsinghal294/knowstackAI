
import json
import os
from pathlib import Path

import requests


API_URL = os.getenv(
    "KNOWSTACK_API_URL",
    "http://127.0.0.1:8000",
)

DATASET_PATH = Path(__file__).with_name("rag_eval.json")

ABSTENTION_PHRASES = [
    "couldn't find",
    "could not find",
    "not enough information",
    "don't have enough information",
    "does not specify",
    "do not specify",
    "can't answer reliably",
    "cannot answer reliably",
    "no information about",
    "no information on",
    "not mentioned in",
    "isn't mentioned",
    "is not mentioned",
    "doesn't contain information",
    "does not contain information",
    "unable to determine",
]


def load_cases():
    with DATASET_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def percentage(numerator, denominator):
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, 2)


def test_rag_evaluation():
    cases = load_cases()
    failures = []

    answer_cases = [
        case for case in cases
        if case["expected_behavior"] == "answer"
    ]
    abstain_cases = [
        case for case in cases
        if case["expected_behavior"] == "abstain"
    ]

    total_requests = len(cases)
    successful_requests = 0
    correct_term_cases = 0
    cited_answer_cases = 0
    correctly_abstained_cases = 0

    for case in cases:
        question = case["question"]

        try:
            response = requests.post(
                f"{API_URL}/api/v1/ask",
                json={
                    "question": question,
                    "top_k": 5,
                },
                timeout=90,
            )
        except requests.RequestException as exc:
            failures.append(
                f"Request failed for '{question}': {exc}"
            )
            continue

        if response.status_code != 200:
            failures.append(
                f"API failed for '{question}': "
                f"{response.status_code} {response.text}"
            )
            continue

        successful_requests += 1

        data = response.json()
        answer = data.get("answer", "").strip()
        citations = data.get("citations", [])

        if not answer:
            failures.append(f"Empty answer for: {question}")
            continue

        answer_lower = answer.lower()
        behavior = case["expected_behavior"]

        if behavior == "abstain":
            has_abstention = any(
                phrase in answer_lower
                for phrase in ABSTENTION_PHRASES
            )
            has_no_citations = not citations

            if has_abstention and has_no_citations:
                correctly_abstained_cases += 1

            if not has_abstention:
                failures.append(
                    f"Expected abstention for '{question}', "
                    f"got: {answer}"
                )

            if citations:
                failures.append(
                    f"Unexpected citations for unsupported "
                    f"question: {question}"
                )

        elif behavior == "answer":
            required_terms = case.get("required_terms", [])

            all_terms_found = all(
                term.lower() in answer_lower
                for term in required_terms
            )

            if all_terms_found:
                correct_term_cases += 1
            else:
                missing_terms = [
                    term for term in required_terms
                    if term.lower() not in answer_lower
                ]
                failures.append(
                    f"Missing expected terms {missing_terms} "
                    f"for question: {question}"
                )

            if citations:
                cited_answer_cases += 1
            else:
                failures.append(
                    f"Expected citations for: {question}"
                )

        else:
            failures.append(
                f"Unknown expected behavior: {behavior}"
            )

    print("\n========== KnowStack AI RAG Evaluation ==========")
    print(f"Total test cases: {total_requests}")
    print(
        f"Successful API requests: {successful_requests}/"
        f"{total_requests} "
        f"({percentage(successful_requests, total_requests)}%)"
    )
    print(
        f"Required-term match rate: {correct_term_cases}/"
        f"{len(answer_cases)} "
        f"({percentage(correct_term_cases, len(answer_cases))}%)"
    )
    print(
        f"Citation rate: {cited_answer_cases}/"
        f"{len(answer_cases)} "
        f"({percentage(cited_answer_cases, len(answer_cases))}%)"
    )
    print(
        f"Correct abstention rate: {correctly_abstained_cases}/"
        f"{len(abstain_cases)} "
        f"({percentage(correctly_abstained_cases, len(abstain_cases))}%)"
    )
    print("==================================================\n")

    assert not failures, "\n".join(failures)
