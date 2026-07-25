"""Life Path skins and Profile Dimension bundles.

`university_success` is transcribed from session-engine.md section 7.
`hospitality` was on the pack's "still to author" list and is authored here so
Samuel's half of the demo has an eight-slot Profile; it follows the same shape and
reuses the dimension bundles section 8 already names for that path.
"""

LIFE_PATHS: list[dict] = [
    {
        "id": "university_success",
        "name": "University Success",
        "domain_priority": {"A2-D01": 1.0, "A2-D06": 0.9, "A2-D02": 0.4, "A2-D03": 0.2},
        "context_substitutions": {
            "Introducing yourself": "Introducing yourself to a university class",
            "Meeting someone new": "Meeting your project group for the first time",
            "Talking about hobbies": "Explaining why you chose your major",
        },
        "vocabulary_overlay": ["major", "lecture", "assignment", "semester", "campus"],
        # Templates outside the demo slice are listed for fidelity to the document and
        # skipped by the loader until their descriptors exist.
        "template_preference": {"EX018": 1.3, "EX017": 1.2, "EX008": 1.1, "EX002": 0.8},
    },
    {
        "id": "hospitality",
        "name": "Hospitality & Tourism",
        "domain_priority": {"A2-D03": 1.0, "A2-D06": 0.9, "A2-D01": 0.7, "A2-D05": 0.5},
        "context_substitutions": {
            "Introducing yourself": "Introducing yourself to a guest at the front desk",
            "Meeting someone new": "Greeting an arriving guest",
            "Talking about hobbies": "Recommending something to do in the city",
        },
        "vocabulary_overlay": ["reservation", "check-in", "concierge", "complaint", "suite"],
        "template_preference": {"EX018": 1.4, "EX007": 1.1},
    },
]

# Five fixed for every learner plus exactly three from the Life Path. Three per path
# is a rule, not a coincidence: the dashboard is a fixed eight-slot layout.
#
# A dimension's value is the evidence-weighted mean mastery of its members, computed
# at read time and never stored. Patterns resolve against whatever competencies exist,
# so a bundle whose content is not yet authored reads as "not yet assessed" rather
# than as zero.
DIMENSIONS: list[dict] = [
    {"id": "grammar", "name": "Grammar", "fixed": True, "position": 1,
     "members": [{"pattern": "G*", "weight": 1.0}]},
    {"id": "vocabulary", "name": "Vocabulary", "fixed": True, "position": 2,
     "members": [{"pattern": "V*", "weight": 1.0}]},
    # The Pronunciation mean excludes observable: false members at read time rather
    # than counting them as zero — no API in the stack scores phonemes.
    {"id": "pronunciation", "name": "Pronunciation", "fixed": True, "position": 3,
     "members": [{"pattern": "P*", "weight": 1.0}]},
    {"id": "fluency", "name": "Fluency", "fixed": True, "position": 4,
     "members": [{"pattern": "F*", "weight": 1.0}]},
    # INTERIM MEMBER LIST. Section 8 settles the mechanism — Confidence is an ordinary
    # bundle fed by delivery metrics through the learner model — but leaves the member
    # list beyond P015.03 to author. These two are the delivery-sensitive
    # sub-competencies in the demo slice: F003.01 is scored on response latency and
    # F002.01 on underproduction, both from word timestamps. Revisit when P015 is
    # authored; nothing here bypasses mastery either way.
    {"id": "confidence", "name": "Confidence", "fixed": True, "position": 5,
     "members": [
         {"pattern": "P015.03", "weight": 1.0},
         {"pattern": "F003.01", "weight": 1.0},
         {"pattern": "F002.01", "weight": 0.6},
     ]},

    {"id": "presentation", "name": "Presentation", "life_path_id": "university_success",
     "position": 6, "members": [{"pattern": "F015.*", "weight": 1.0}]},
    {"id": "academic_discussion", "name": "Academic Discussion",
     "life_path_id": "university_success", "position": 7,
     "members": [{"pattern": "F013.*", "weight": 1.0}, {"pattern": "F009.*", "weight": 1.0}]},
    {"id": "classroom_interaction", "name": "Classroom Interaction",
     "life_path_id": "university_success", "position": 8,
     "members": [{"pattern": "F004.*", "weight": 1.0}, {"pattern": "F019.*", "weight": 1.0}]},

    {"id": "guest_interaction", "name": "Guest Interaction", "life_path_id": "hospitality",
     "position": 6,
     "members": [{"pattern": "F007.*", "weight": 1.0}, {"pattern": "F019.*", "weight": 1.0}]},
    {"id": "complaint_handling", "name": "Complaint Handling", "life_path_id": "hospitality",
     "position": 7,
     "members": [{"pattern": "F011.*", "weight": 1.0}, {"pattern": "F020.*", "weight": 1.0}]},
    {"id": "interview_readiness", "name": "Interview Readiness", "life_path_id": "hospitality",
     "position": 8,
     "members": [{"pattern": "F003.*", "weight": 1.0}, {"pattern": "F009.*", "weight": 1.0},
                 {"pattern": "F018.*", "weight": 1.0}]},
]
