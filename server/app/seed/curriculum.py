"""Layer 1: the A2 domains, and A2-D01's requirement roles.

Transcribed from docs/curriculum/domains.md. Only A2-D01 carries requirement roles
so far; the other five A2 domains are seeded as name-only rows because the
`university_success` skin assigns them priorities and the Day Plan needs somewhere
to go once A2-D01 completes.
"""

DOMAINS: list[dict] = [
    {
        "id": "A2-D01",
        "cefr": "A2",
        "name": "Personal Life",
        "description": "Communicate about oneself and familiar people in everyday situations.",
        "objectives": [
            "Introduce yourself confidently.",
            "Describe family and friends.",
            "Talk about daily routines.",
            "Express basic likes and dislikes.",
            "Describe personal experiences.",
        ],
        # Rotation order for the Day Plan theme. Day one takes the first; the second
        # is what Hana meets on day three.
        "practice_contexts": [
            "Introducing yourself",
            "Meeting someone new",
            "Family gathering",
            "Talking about hobbies",
            "Daily routine",
            "Weekend activities",
        ],
        "requires": [
            # Vocabulary
            {"competency": "V001", "role": "core",
             "subs": ["V001.01", "V001.02", "V001.03", "V001.05"]},
            {"competency": "V003", "role": "core", "subs": ["V003.01", "V003.03", "V003.07"]},
            {"competency": "V002", "role": "supporting"},
            {"competency": "V014", "role": "supporting"},
            {"competency": "V015", "role": "supporting"},
            {"competency": "V016", "role": "incidental"},
            # Grammar
            {"competency": "G001", "role": "core", "subs": ["G001.01", "G001.03", "G001.05"]},
            {"competency": "G003", "role": "core", "subs": ["G003.01", "G003.04"]},
            {"competency": "G005", "role": "core", "subs": ["G005.01", "G005.04", "G005.05"]},
            {"competency": "G006", "role": "core", "subs": ["G006.01", "G006.05"]},
            {"competency": "G002", "role": "supporting"},
            {"competency": "G009", "role": "supporting"},
            {"competency": "G004", "role": "incidental"},
            # Pronunciation. P001.01-P001.07 are observable: false, so the supporting
            # expansion of P001 yields P001.08 alone.
            {"competency": "P005", "role": "core", "subs": ["P005.01", "P005.03"]},
            {"competency": "P001", "role": "supporting"},
            {"competency": "P003", "role": "supporting"},
            {"competency": "P014", "role": "supporting"},
            {"competency": "P002", "role": "incidental"},
            {"competency": "P004", "role": "incidental"},
            # Fluency
            {"competency": "F002", "role": "core", "subs": ["F002.01", "F002.06"]},
            {"competency": "F003", "role": "core", "subs": ["F003.01"]},
            {"competency": "F001", "role": "supporting"},
            {"competency": "F004", "role": "supporting"},
        ],
    },
    {"id": "A2-D02", "cefr": "A2", "name": "Home & Community",
     "description": "Communicate about familiar places and navigate common local situations."},
    {"id": "A2-D03", "cefr": "A2", "name": "Everyday Transactions",
     "description": "Handle routine service interactions confidently."},
    {"id": "A2-D04", "cefr": "A2", "name": "Health & Well-being",
     "description": "Communicate simple health concerns and healthy habits."},
    {"id": "A2-D05", "cefr": "A2", "name": "Travel",
     "description": "Handle common travel situations."},
    {"id": "A2-D06", "cefr": "A2", "name": "Social Interaction",
     "description": "Participate naturally in short everyday conversations."},
]
