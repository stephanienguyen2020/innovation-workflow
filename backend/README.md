im designing a backend for the app where the web helps users to upload the pdf and generate problems statements, ideas, finalized pdf containing the analysis, user chosen problem statements, product ideas along with detailed explanation.

- There are 4 stages, each is done one after another, and user can come back and edit the prior
- User can regenerate ideas when they need to. Any changes in earlier stage should lead to regenerating data in the subsequent stages,
- When user creates the project, create a new project document
- For example, when user changes stage 2, upserting Stage 3 and Stage 4:

  - If Stage 3 or Stage 4 must be updated when Stage 2 is modified (because they are dependent on Stage 2), then you can perform an upsert or update operation for Stage 3 and Stage 4 to reflect the new changes.

  - If Stage 3 and Stage 4 are empty or unmodified, there is no need to perform an upsert operation on them, unless you're explicitly generating new content for these stages based on the updates in Stage

2.

List of APIs: + "stage 1" api upload pdf: injest service + analysis service -> returns 1 analysis for the uploaded pdf (what is the pdf about)

    + "stage 2" api problem definition:
    	+ Request: Analysis + documents (output of prior stages)
    	+ Response: 4 problem statements based on the analysis,
    	{
    		+ "Problem statement": "explannation"
    	}


    + "stage 3" api:
    	+ Request: Analysis + Problem + documents (output of prior stages)
    	+ Response: 3 products idea + Detailed explanation of idea 1 ...


    + additional api regenerate:

- Regenerate ideas

"final stage" api returns pdf: (Congrats on finishing the workflow here is a documentation for your reference)
MongoDB Design
Project Document:

Each project is stored as a single document in the projects collection.

This document will hold information about the project status, user, and stages.

Stages as Subdocuments:

Instead of having separate collections for stages and stage data, you can store stages as embedded subdocuments within the project document.

Each stage will hold its status, data, and associated metadata (timestamps, etc.).

Upserts:

When a user updates a previous stage (e.g., changing stage 1 analysis), you will perform an upsert on the entire project document. This will ensure that the latest data is reflected in the document and also cascade any necessary changes to later stages (depending on your application logic).
MongoDB Schema Design
Projects Collection

```
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "status": "in_progress",  // e.g., 'in_progress', 'completed'
  "created_at": ISODate("..."),
  "updated_at": ISODate("..."),
  "stages": [
    {
      "stage_number": 1,
      "status": "completed",  // e.g., 'completed', 'in_progress', 'not_started'
      "data": {
        "analysis": "Analysis result data here..."
      },
      "created_at": ISODate("..."),
      "updated_at": ISODate("...")
    },
    {
      "stage_number": 2,
      "status": "not_started",
      "data": {
        "problem_statements": [
          { "problem": "Problem statement 1", "explanation": "Explanation 1" },
          { "problem": "Problem statement 2", "explanation": "Explanation 2" },
          { "problem": "Problem statement 3", "explanation": "Explanation 3" },
          { "problem": "Problem statement 4", "explanation": "Explanation 4" }
        ]
      },
      "created_at": ISODate("..."),
      "updated_at": ISODate("...")
    },
    {
      "stage_number": 3,
      "status": "not_started",
      "data": {
        "product_ideas": [
          { "idea": "Idea 1", "detailed_explanation": "Explanation 1" },
          { "idea": "Idea 2", "detailed_explanation": "Explanation 2" },
          { "idea": "Idea 3", "detailed_explanation": "Explanation 3" }
        ]
      },
      "created_at": ISODate("..."),
      "updated_at": ISODate("...")
    },
    {
      "stage_number": 4,
      "status": "not_started",
      "data": {
        "final_pdf": "Final PDF content here..."
      },
      "created_at": ISODate("..."),
      "updated_at": ISODate("...")
    }
  ]
}

```

Run backend

```
python -m venv env
./env/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload or uvicorn main:app --host 127.0.0.1 --port 8000
```
