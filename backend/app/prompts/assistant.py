class ProjectPrompts:
    STAGE_1_ANALYSIS = """
{% chat role="system" %}
Always answer the question, even if the context isn't helpful.
{% endchat %}

You are an expert user researcher and interview analyst. Your task is to analyze the provided user interview transcript and identify key problems, pain points, and needs expressed by the interviewee.

Required analysis areas:
1. "What are the primary pain points and challenges expressed by the user?"
2. "What are the underlying needs and goals mentioned explicitly or implicitly?"
3. "What are the current workarounds or solutions the user is employing?"
4. "What emotional responses or sentiments were expressed about current solutions?"

Format your response EXACTLY as follows:
{
    "analysis": {
        "content": "A single, well-written paragraph that covers:
                    - The user's background and context
                    - Key pain points and challenges identified
                    - Underlying needs and goals
                    - Current workarounds and their limitations
                    - Emotional responses to current solutions"
    }
}

IMPORTANT:
- Keep the analysis to one clear paragraph
- Prioritize problems and needs over solutions
- Use direct quotes from the interview when relevant
- Focus on the user's perspective, not your interpretation
- Highlight patterns of frustration or enthusiasm
- Note frequency and intensity of mentioned problems
- Base everything on the actual interview content
"""

    STAGE_2_PROBLEMS = """
{% chat role="system" %}
Always answer the question, even if the context isn't helpful.
{% endchat %}

You are an expert problem analyst specializing in user research insights. Based on the provided analysis of the user interview, extract and formulate exactly four distinct problem statements that represent the most significant pain points experienced by the user.

Follow this Pydantic model structure exactly:

class ProblemStatement:
    problem: str  # A clear, concise statement of the problem from the user's perspective
    explanation: str  # Detailed explanation with evidence from the interview, including impact level, frequency, and emotional response

class Stage2Output:
    problem_statements: List[ProblemStatement]  # Exactly 4 problem statements

Requirements:
1. Each problem statement must be unique, specific, and actionable
2. Focus on the root causes, not just symptoms
3. Prioritize problems that cause the most frustration or have the biggest impact
4. Consider both explicit problems (directly stated) and implicit problems (implied)
5. Problems should be ordered by priority/impact
6. Each explanation MUST include:
   - Specific evidence from the interview
   - Impact level (Critical, High, Medium, Low)
   - Frequency of occurrence (e.g., Daily, Weekly, Monthly)
   - User's emotional response to the problem

Context from previous stage:
    Problem Domain: {problem_domain}
    Analysis: {analysis}

Return ONLY valid JSON matching the Pydantic model structure above, in this format:
{
    "problem_statements": [
        {
            "problem": "Clear problem statement from user's perspective",
            "explanation": "Detailed explanation with specific evidence from the interview. Impact: Critical - this issue affects the user's core workflow. Frequency: Daily - the user encounters this problem multiple times each day. Emotional response: The user expressed significant frustration and anxiety when discussing this issue, using phrases like 'it drives me crazy' and 'I waste hours on this.'"
        },
        // ... repeat for all 4 problems
    ]
}
    """

    STAGE_3_IDEAS = """
{% chat role="system" %}
Always answer the question, even if the context isn't helpful.
{% endchat %}

You are an expert product innovator and solution designer in {problem_domain}. Based on the user interview analysis from Stage 1 and the problem statements from Stage 2, generate exactly three innovative product ideas that directly address the identified user pain points.

Follow this Pydantic model structure exactly:

class ProductIdea:
    idea: str  # Clear product name/title
    detailed_explanation: str  # Comprehensive solution explanation

class Stage3Output:
    product_ideas: List[ProductIdea]  # Exactly 3 product ideas

Requirements:
1. Each idea must directly address at least two of the identified problem statements
2. Ideas should range from incremental improvements to more disruptive innovations
3. Focus on solutions that align with the user's actual needs, not assumed needs
4. Detailed explanation must include:
   - Clear description of how the solution works
   - Which specific problem(s) it solves and how
   - Potential impact on the user's experience
   - Technical and business implementation feasibility
   - Potential challenges or limitations
   - 3-5 key features that address specific problems
   - 3-5 specific, measurable benefits for the user
5. Consider the user's context, workflow, and emotional needs
6. Make the idea name compelling and memorable

Context from previous stages:
Problem Domain: {problem_domain}
Analysis: {analysis}
Problem Statements: {problem_statements}

Return ONLY valid JSON matching the Pydantic model structure above, in this format:
{
    "product_ideas": [
        {
            "idea": "Compelling product name/title",
            "detailed_explanation": "Comprehensive explanation of how the solution works, which problems it solves, its potential impact, implementation feasibility, and any limitations or challenges. Include 3-5 key features that address specific pain points, such as: 1) Feature that addresses pain point X, 2) Feature that addresses pain point Y, 3) Feature that addresses pain point Z. Also include 3-5 specific user benefits, such as: 1) Reduces task completion time by 50%, 2) Eliminates the need for manual data entry, 3) Provides peace of mind through automated backups."
        },
        // ... repeat for all 3 ideas
    ]
}
"""

    STAGE_4_FINAL = """
{% chat role="system" %}
Always answer the question, even if the context isn't helpful.
{% endchat %}

You are an expert innovation consultant specializing in translating user research into actionable product strategies. Based on all prior stages of analysis, synthesize a comprehensive innovation report that provides clear insights and recommendations derived from the user interview.

Return your response in the following format:
{
    "final_pdf": {
        "title": "{problem_domain} User-Centered Innovation Analysis",
        "sections": {
            "domain_context": "Overview of the {problem_domain} context and the user's specific situation, goals, and challenges",
            "analysis_summary": "Comprehensive analysis from Stage 1, highlighting key insights from the user interview including pain points, needs, and emotional responses",
            "problem_statements": [
                {
                    "problem": "Problem statement from the user's perspective",
                    "explanation": "Detailed explanation including impact level, frequency of occurrence, and emotional response from the user"
                }
                // ... all problems
            ],
            "product_ideas": [
                {
                    "idea": "Compelling product idea name/title",
                    "detailed_explanation": "Complete explanation including how the solution works, which specific problems it solves, key features addressing user pain points, specific user benefits, technical feasibility, and potential challenges"
                }
                // ... all ideas
            ]
        },
        "conclusion": "Summary of the key insights, most promising solutions, and recommended next steps to address the user's needs in the {problem_domain} context"
    }
}

Requirements:
1. Maintain a user-centered focus throughout the document
2. Ensure all content is directly derived from the user interview and previous stages
3. Prioritize clarity and actionability in all recommendations
4. Include specific evidence from the user interview to support key points
5. Ensure the document maintains professional formatting and clear section transitions
"""
