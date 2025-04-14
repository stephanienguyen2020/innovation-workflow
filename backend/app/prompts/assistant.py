class ProjectPrompts:
    STAGE_1_ANALYSIS = """
    Analyze the uploaded PDF and summarize its key points, main topics, 
    and any relevant information that can help in understanding the context 
    of the document. Provide a concise analysis of what the document is about.
    
    Return your response in a clear, well-structured paragraph.
    """

    STAGE_2_PROBLEMS = """
    You are an expert problem analyst. Based on the provided analysis of the uploaded PDF, generate exactly four problem statements.
    Each problem statement must be clear, relevant, and align with the analysis content.

    Follow this Pydantic model structure exactly:

    class ProblemStatement:
        problem: str  # A clear, concise statement of the problem
        explanation: str  # Detailed explanation connecting to the analysis

    class Stage2Output:
        problem_statements: List[ProblemStatement]  # Exactly 4 problem statements

    Requirements:
    1. Each problem statement must be unique and actionable
    2. Each explanation must reference specific points from the analysis
    3. Problems should be ordered by priority/impact
    4. Use professional, clear language

    Context from previous stage:
    {analysis}

    Return ONLY valid JSON matching the Pydantic model structure above, in this format:
    {
        "problem_statements": [
            {
                "problem": "Clear problem statement 1",
                "explanation": "Detailed explanation of the problem and its context"
            },
            // ... repeat for all 4 problems
        ]
    }
    """

    STAGE_3_IDEAS = """
    You are an expert product innovator. Using the analysis from Stage 1 and problem statements from Stage 2, 
    generate exactly three product ideas that solve the identified problems.

    Follow this Pydantic model structure exactly:

    class ProductIdea:
        idea: str  # Clear product name/title
        detailed_explanation: str  # Comprehensive solution explanation

    class Stage3Output:
        product_ideas: List[ProductIdea]  # Exactly 3 product ideas

    Requirements:
    1. Each idea must directly address one or more problem statements
    2. Detailed explanation must include:
       - Which problem(s) it solves
       - Potential impact
       - Implementation feasibility
    3. Ideas should be innovative yet practical
    4. Use professional, clear language

    Context from previous stages:
    Analysis: {analysis}
    Problem Statements: {problem_statements}

    Return ONLY valid JSON matching the Pydantic model structure above, in this format:
    {
        "product_ideas": [
            {
                "idea": "Clear product idea name/title",
                "detailed_explanation": "Comprehensive explanation including how it solves the problem, potential impact, and feasibility"
            },
            // ... repeat for all 3 ideas
        ]
    }
    """

    STAGE_4_FINAL = """
    Based on the data from all prior stages, generate a finalized document that includes 
    all the key information in a structured format. 

    Return your response in the following format:
    {
        "final_pdf": {
            "title": "Innovation Workflow Analysis",
            "sections": {
                "analysis_summary": "Comprehensive analysis from Stage 1",
                "problem_statements": [
                    {
                        "problem": "Problem statement",
                        "explanation": "Detailed explanation"
                    }
                    // ... all problems
                ],
                "product_ideas": [
                    {
                        "idea": "Product idea",
                        "detailed_explanation": "Complete explanation"
                    }
                    // ... all ideas
                ]
            },
            "conclusion": "Summary of the entire workflow and next steps"
        }
    }

    Ensure the document maintains professional formatting and clear section transitions.
    """
