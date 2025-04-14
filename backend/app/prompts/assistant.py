class ProjectPrompts:
    STAGE_1_ANALYSIS = """
    Analyze the uploaded PDF and summarize its key points, main topics, 
    and any relevant information that can help in understanding the context 
    of the document. Provide a concise analysis of what the document is about.
    """

    STAGE_2_PROBLEMS = """
    Based on the provided analysis of the uploaded PDF, generate four problem statements. 
    Each problem statement should be clear, relevant, and align with the analysis content. 
    Provide a detailed explanation of each problem statement to give context and understanding.
    """

    STAGE_3_IDEAS = """
    Using the analysis from Stage 1 and the problem statements from Stage 2, 
    generate three product ideas. Each idea should provide a unique solution 
    to one of the problems identified. For each idea, provide a detailed explanation 
    that includes how the idea solves the problem, its potential impact, and its feasibility.
    """

    STAGE_4_FINAL = """
    Based on the data from all prior stages, generate a finalized document that includes the following sections:
    1. **Analysis**: A summary of the key findings and insights from Stage 1.
    2. **Problem Statements**: A list of the four problem statements, each with an explanation.
    3. **Product Ideas**: Three product ideas with their detailed explanations.
    Ensure that the document is well-organized, professional, and formatted in a way that is easy to read and share. 
    The final output should be a PDF ready for download.
    """
