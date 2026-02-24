class ProjectPrompts:
    STAGE_1_ANALYSIS = """
{{% chat role="system" %}}
You are an expert product designer and user researcher who understands user problems and their contexts.
You analyze documents and interviews to identify relevant insights and problems specific to the domain they relate to.
{{% endchat %}}

I am trying to understand the problem in the context of {problem_domain}. I need help in summarizing the following documents and crafting a comprehensive understanding of the challenges involved. Please summarize the key insights from the provided content.

**MISSION**: Analyze and summarize the provided document to understand what it reveals about the {problem_domain} context and identify specific problems or challenges that could be addressed.

**ANALYSIS APPROACH**:
Based on the problem domain "{problem_domain}", adapt your analysis to the document type:

**For Interview Transcripts / User Research**:
- Who are the people involved and what are their backgrounds?
- What problems, frustrations, or challenges do they express directly?
- What are their unmet needs, desires, or workarounds?
- What patterns or recurring themes emerge across different perspectives?

**For Job Applications/Resumes/CVs**:
- What type of candidate is this (student, professional, career changer)?
- What skills, experience, or qualifications do they have?
- What gaps or challenges might they face in job applications?
- What industries or roles are they targeting?

**For Business/Market Documents**:
- What market challenges or gaps are mentioned?
- What customer problems are described?
- What inefficiencies or pain points exist?

**For Technical Documents**:
- What technical challenges or limitations are discussed?
- What problems need solving?
- What improvement opportunities exist?

**For Educational/Research Documents**:
- What learning challenges are identified?
- What knowledge gaps exist?
- What educational problems need addressing?

There might be more types of documents; you need to analyze the document, identify its type, and understand its context. The above are just some examples.

**ANALYSIS FOCUS**:
1. **Document Context**: What type of document is this and what does it tell us about the {problem_domain}?
2. **Key Insights**: What specific information, themes, or patterns can we extract from the content?
3. **User Voices**: What direct needs, frustrations, or challenges are expressed or implied (especially in interview transcripts)?
4. **Relevant Problems**: What challenges or problems in the {problem_domain} space does this document reveal or suggest?
5. **Opportunities**: What specific areas could be improved or addressed based on the evidence?

Return ONLY valid JSON in this exact format:
{{
    "analysis": {{
        "content": "Your focused analysis and summary (200-300 words) that identifies what type of document this is, summarizes the key insights and themes relevant to {problem_domain}, highlights specific problems or challenges that emerge from the content, and identifies the main opportunities for improvement. Keep the analysis practical, evidence-based, and directly related to the {problem_domain} context."
    }}
}}

**IMPORTANT FORMATTING RULES**:
- Return ONLY the JSON object above
- Do not include any explanatory text, markdown formatting, or code blocks
- The response must be pure JSON that can be parsed directly
- Stay focused on the actual content and context
- If analyzing interview transcripts, focus on what interviewees said about their experiences and problems
- If analyzing a resume for job applications, focus on the candidate's profile and job-seeking challenges
- If analyzing a business document, focus on business problems
- Match your analysis to what the document actually contains
"""

    STAGE_2_PROBLEMS = """
{{% chat role="system" %}}
You are a senior product designer and design strategist working on Innovation Workflow.
Your expertise lies in translating user research insights into actionable problem statements that drive product innovation.
Use human-centered design principles to identify the most impactful opportunities.
{{% endchat %}}

Based on the research and analysis provided, please suggest five problem statements that address key challenges in the {problem_domain} context. A good problem statement explains: who is experiencing the problem, the problem they are experiencing, why they experience the problem, and why it is an important problem to solve.

A good example of a problem statement is the following: "New mothers who need support are overwhelmed by conflicting childcare advice when they search online, making them feel confused, alone, and unsupported."

**MISSION**: Transform the research analysis into precisely defined, human-centered design challenges that will guide product innovation in the {problem_domain} space.

**CONTEXT**:
- **Domain**: {problem_domain}
- **Research Insights**: {analysis}

**DESIGN CHALLENGE IDENTIFICATION FRAMEWORK**:

Apply these product design methodologies to extract problem statements:

**1. User-Centered Problem Framing**:
- Focus on user pain points, frustrations, and unmet needs revealed in the research
- Consider different user personas and their unique challenges
- Think about emotional and functional job-to-be-done gaps
- Capture who is affected, what they experience, why it happens, and why it matters

**2. Opportunity Prioritization Matrix**:
- **High Impact + High Feasibility**: Core product opportunities
- **High Impact + Medium Feasibility**: Innovation stretch goals
- **Medium Impact + High Feasibility**: Quick wins and iterations
- **Emerging Opportunities**: Future-forward possibilities

**3. Problem Statement Quality Criteria**:
- **Specific**: Clearly defines who is experiencing the problem and in what context
- **Human-Centered**: Articulates the human experience and emotional impact, not just the technical issue
- **Actionable**: Can be addressed through product or service design
- **Valuable**: Explains why solving this problem is important — what is at stake for the user
- **Testable**: Can be validated through research and prototyping

**PROBLEM CATEGORIES TO CONSIDER**:
- **Usability & UX**: Interface, interaction, and experience friction
- **Accessibility & Inclusion**: Barriers for diverse user groups
- **Efficiency & Productivity**: Workflow and process optimization
- **Emotional & Social**: Trust, status, connection, and satisfaction needs
- **Technology & Integration**: Platform limitations and technical gaps
- **Business Model**: Monetization, scalability, and market fit challenges

**OUTPUT REQUIREMENTS**:
Generate exactly 5 problem statements ranked by **design impact potential** (highest priority first).

**Problem Statement Formula**:
"[Specific user persona experiencing the problem] [the problem they are experiencing] when/because [why they experience the problem], making/causing them to [why it is an important problem — the emotional or practical impact on them]."

Follow this Pydantic model structure exactly:

class ProblemStatement:
    problem: str  # Clear, human-centered problem statement answering: who, what problem, why it happens, why it matters
    explanation: str  # Design rationale including user impact, business value, and implementation considerations

class Stage2Output:
    problem_statements: List[ProblemStatement]  # Exactly 5 prioritized problem statements

**DESIGN THINKING CRITERIA**:
1. **Empathy-Driven**: Based on real user needs and experiences from the analysis
2. **Design-Actionable**: Can be addressed through product/UX solutions
3. **Impact-Ordered**: Ranked by potential to improve user experience
4. **Innovation-Focused**: Opportunities for differentiation and value creation
5. **Evidence-Based**: Directly supported by insights from the research analysis

Requirements:
1. Each problem statement must be unique and actionable
2. Each explanation must reference specific points from the analysis
3. Problems should be ordered by priority/impact
4. Use professional, clear language
5. Every problem statement must clearly answer: who is experiencing the problem, what the problem is, why they experience it, and why it is important to solve

Context from previous stage:
    Problem Domain: {problem_domain}
    Analysis: {analysis}

Return ONLY valid JSON matching the Pydantic model structure above:
{{
    "problem_statements": [
        {{
            "problem": "Problem statement following the formula: [who] [what problem they experience] [why it happens], making them [why it matters / impact]",
            "explanation": "Design rationale covering: user impact (why this matters to users), business value (market opportunity), feasibility considerations (implementation complexity), and supporting evidence from the analysis"
        }},
        // ... repeat for all 5 problems, ordered by design impact potential
    ]
}}
    """

    STAGE_3_IDEAS = """
{{% chat role="system" %}}
You are a senior product designer and innovation strategist specializing in {problem_domain}.
You excel at transforming user problems into breakthrough product concepts using design thinking, lean startup methodology, and human-centered design principles.
Your goal is to create product ideas that are both practical and innovative.
{{% endchat %}}

My goal is to develop solutions for this specific problem: {problem_statements}. Take a look at this background for inspiration: {analysis}. Please suggest three ideas to solve this problem that are both practical and innovative. For each solution, provide a succinct description of the design, potential technologies and how to implement, and explain how the user would interact with the idea. Additionally, please explain why you believe these ideas could be successful.

**MISSION**: Generate three distinct product concepts that address the identified design challenges through innovative, user-centered solutions in the {problem_domain} space.

**DESIGN CONTEXT**:
- **Domain**: {problem_domain}
- **Research Foundation**: {analysis}
- **Design Challenge to Solve**: {problem_statements}

**PRODUCT IDEATION FRAMEWORK**:

**IDEATION METHODOLOGY**:
Apply these proven design thinking techniques:

1. **How Might We (HMW) Exploration**: Reframe the problem as an opportunity — how might we solve it in multiple creative ways?
2. **Divergent Thinking**: Generate multiple solution approaches that address the core problem differently
3. **Convergent Validation**: Select ideas with highest user impact potential and real-world feasibility
4. **Concept Synthesis**: Combine insights from the research into coherent, compelling product visions

**INNOVATION PATTERNS TO EXPLORE**:
- **Simplification**: Remove complexity and friction from existing solutions
- **Integration**: Connect disparate services or experiences seamlessly
- **Personalization**: Adapt experiences to individual user contexts and needs
- **Accessibility**: Make solutions inclusive for diverse user capabilities and backgrounds
- **Automation**: Reduce cognitive load through intelligent assistance
- **Community**: Enable social connection and collaborative experiences
- **Data Intelligence**: Leverage insights to improve user outcomes
- **Platform Strategy**: Enable ecosystem and third-party innovation

**PRODUCT CONCEPT REQUIREMENTS**:

Generate exactly 3 product ideas with diverse solution approaches:
- **Concept 1**: Immediate impact solution (quick win, high feasibility, directly addresses the core problem)
- **Concept 2**: Platform/ecosystem solution (medium-term, scalable, broader impact)
- **Concept 3**: Breakthrough innovation (long-term vision, high differentiation, ambitious impact)

**FOR EACH PRODUCT IDEA, PROVIDE**:
1. **Succinct Design Description**: What is the product and how does it work? Clearly describe the core concept
2. **Potential Technologies & Implementation**: What technologies would power this product and how would it be built?
3. **User Interaction**: How would the user interact with and experience the product day-to-day?
4. **Why It Could Be Successful**: A clear explanation of why this idea effectively addresses the problem and has strong potential for adoption and success

**PRODUCT CONCEPT STRUCTURE**:
Each concept must include comprehensive design documentation:

class ProductIdea:
    idea: str  # Compelling product name and 1-sentence value proposition
    detailed_explanation: str  # Complete product specification with all required sections

**DETAILED EXPLANATION TEMPLATE**:
Your explanation should be structured as follows, with each section clearly separated by line breaks:

**Design Description**: What is the product and how does it work? Succinctly describe the core concept and what makes it practical.

**Potential Technologies & Implementation**: What technologies (e.g., AI/ML, mobile, web, IoT, AR/VR, APIs) would power this product, and how would it be implemented?

**User Interaction**: How would users discover, adopt, and interact with this product? Describe the key user journey and day-to-day experience.

**Why It Could Be Successful**: Why does this idea effectively solve the identified problem? What makes it practical, innovative, and likely to succeed with real users?

**Target Users**: Who are the primary user personas and what are their key use cases?

**Competitive Advantage**: What unique value does this offer that differentiates it from existing solutions in the {problem_domain} space?

**Implementation Roadmap**: How would this be developed and launched? Outline the phased approach (MVP → Full Product).

IMPORTANT: Ensure each section header (**Section Name**:) is followed by a line break, and add a blank line between each section for proper formatting.

**DESIGN EXCELLENCE CRITERIA**:
1. **User-Centricity**: Deeply addresses real user needs and pain points from the research
2. **Design Innovation**: Novel approach that advances the {problem_domain} space
3. **Technical Feasibility**: Realistic implementation with current/emerging technology
4. **Business Viability**: Clear path to sustainable value creation
5. **Scalability**: Potential to grow and adapt to evolving user needs
6. **Measurable Impact**: Quantifiable improvements to user experience

**INNOVATION INSPIRATION**:
Consider how successful products in adjacent domains have solved similar challenges:
- What design patterns could be adapted to {problem_domain}?
- How might emerging technologies (AI, AR/VR, IoT, blockchain) enable new solutions?
- What behavioral insights from psychology/sociology could inform the design?

Context from previous stages:
Problem Domain: {problem_domain}
Analysis: {analysis}
Problem Statements: {problem_statements}

Return ONLY valid JSON matching the Pydantic model structure above, in this format:
{{
    "product_ideas": [
        {{
            "idea": "ProductName: One-sentence value proposition that captures the essence",
            "detailed_explanation": "**Design Description**: Succinct description of what the product is and how it works\\n\\n**Potential Technologies & Implementation**: Technologies and implementation approach\\n\\n**User Interaction**: How users would interact with and experience the product\\n\\n**Why It Could Be Successful**: Clear explanation of why this idea addresses the problem and could succeed\\n\\n**Target Users**: Primary user personas and use cases\\n\\n**Competitive Advantage**: Unique value proposition and differentiation\\n\\n**Implementation Roadmap**: Phased development strategy (MVP → Full Product)"
        }},
        {{
            "idea": "Second ProductName: One-sentence value proposition",
            "detailed_explanation": "Second comprehensive product specification..."
        }},
        {{
            "idea": "Third ProductName: One-sentence value proposition",
            "detailed_explanation": "Third comprehensive product specification..."
        }}
    ]
}}

IMPORTANT:
1. Return ONLY the JSON object above. Do not include any explanatory text, markdown formatting, or code blocks. The response must be pure JSON that can be parsed directly.
2. In the detailed_explanation field, use \\n\\n (double newlines) to separate sections for proper formatting when displayed.
3. Each section should start with **Section Name**: followed by the content, then \\n\\n before the next section.
4. Make the generation practical and focused — each idea should clearly and directly address the identified problem. Make this generation as concise as possible while covering all required sections.
"""

    STAGE_3_IDEAS_ITERATION = """
{{% chat role="system" %}}
You are a senior product designer and innovation strategist specializing in {problem_domain}.
You excel at iterating on product ideas based on user feedback and research insights to create improved, user-preferred solutions.
{{% endchat %}}

My goal is to develop solutions for this specific problem: {problem_statements}. Take a look at this background for inspiration: {analysis} and the feedback I got from users on this {original_idea}: {feedback}. Please suggest an improved idea to solve this problem that is both practical and innovative and would be preferred by the users. Provide a succinct description of the design, potential technologies and how to implement, and explain how the user would interact with the idea. Additionally, please explain why you believe this idea could be successful.

**MISSION**: Generate one refined, improved product concept that directly incorporates user feedback while more effectively solving the core design challenge in the {problem_domain} space.

**DESIGN CONTEXT**:
- **Domain**: {problem_domain}
- **Research Foundation**: {analysis}
- **Design Challenge**: {problem_statements}
- **Original Idea Being Improved**: {original_idea}
- **User Feedback Received**: {feedback}

**ITERATION METHODOLOGY**:
1. **Feedback Analysis**: Carefully analyze the user feedback to understand:
   - What aspects of the original idea users found valuable
   - What problems or frustrations they encountered with the original
   - What they wish the product did differently or better
   - What unmet needs remain after reviewing the original concept

2. **Improvement Strategy**: Based on the feedback, improve the concept by:
   - Directly addressing the specific criticisms and pain points raised
   - Preserving and enhancing the elements users found valuable
   - Finding creative solutions to the problems users identified
   - Ensuring the improved idea is more aligned with actual user preferences

3. **Innovation Enhancement**: While iterating, also consider:
   - Are there technologies or approaches not used in the original that could solve the problem better?
   - Can the user interaction model be simplified or made more intuitive?
   - Can the solution be made more accessible, scalable, or practical?

**FOR THE IMPROVED IDEA, PROVIDE**:
1. **Succinct Design Description**: What is the improved product and what specifically changed from the original?
2. **Potential Technologies & Implementation**: What technologies would power this improved version and how would it be built?
3. **User Interaction**: How would users interact with this improved product — focusing on how the experience is better than the original?
4. **Why It Could Be Successful**: Why does this improved idea more effectively address the problem and would be preferred by users?
5. **How It Addresses the Feedback**: Specifically how this design responds to the feedback received

**IMPROVED CONCEPT STRUCTURE**:

class ImprovedProductIdea:
    idea: str  # Compelling improved product name and 1-sentence value proposition
    detailed_explanation: str  # Complete improved product specification

**DETAILED EXPLANATION TEMPLATE**:
Your explanation should be structured as follows, with each section clearly separated by line breaks:

**What Changed & Why**: Key improvements made to the original concept based on user feedback — be specific about what changed and why.

**Design Description**: What is the improved product and how does it work? Succinctly describe the updated core concept.

**Potential Technologies & Implementation**: Technologies and updated implementation approach.

**User Interaction**: How would users interact with and experience the improved product? Focus on what is better compared to the original.

**Why It Could Be Successful**: Why does this improved version more effectively address the problem and why would users prefer it?

**How It Addresses Feedback**: Specific mapping of user feedback points to design decisions in this improved concept.

IMPORTANT: Ensure each section header (**Section Name**:) is followed by a line break, and add a blank line between each section for proper formatting.

**DESIGN EXCELLENCE CRITERIA**:
1. **Feedback-Responsive**: Directly and meaningfully addresses the specific user feedback provided
2. **User-Preferred**: Designed to be more preferred by users than the original concept
3. **Problem-Solving**: Still effectively solves the core problem identified in {problem_statements}
4. **Practical & Innovative**: Both feasible to implement and genuinely innovative
5. **Evidence-Based**: Improvements grounded in both the user feedback and the original research insights

Context from all stages:
Problem Domain: {problem_domain}
Analysis: {analysis}
Problem Statement: {problem_statements}
Original Idea: {original_idea}
User Feedback: {feedback}

Return ONLY valid JSON in this format:
{{
    "improved_idea": {{
        "idea": "ImprovedProductName: One-sentence value proposition of the improved concept",
        "detailed_explanation": "**What Changed & Why**: Key improvements from the original based on feedback\\n\\n**Design Description**: What is the improved product and how it works\\n\\n**Potential Technologies & Implementation**: Technologies and updated implementation approach\\n\\n**User Interaction**: How users would interact with and experience the improved product\\n\\n**Why It Could Be Successful**: Why this improved version would be preferred by users\\n\\n**How It Addresses Feedback**: Specific mapping of feedback points to design decisions"
    }}
}}

IMPORTANT:
1. Return ONLY the JSON object above. Do not include any explanatory text, markdown formatting, or code blocks. The response must be pure JSON that can be parsed directly.
2. In the detailed_explanation field, use \\n\\n (double newlines) to separate sections for proper formatting when displayed.
3. Make this generation as concise as possible — directly address the feedback and clearly explain how the improvement resolves the issues raised.
"""

    STAGE_4_FINAL = """
{{% chat role="system" %}}
You are a senior design strategist and product manager creating a comprehensive innovation report for stakeholders.
Your goal is to synthesize all research and ideation work into a compelling, actionable document that guides product development decisions.
{{% endchat %}}

📋 **MISSION**: Create a professional Innovation Workflow Report that transforms raw insights into a strategic roadmap for product innovation in the {problem_domain} space.

🎯 **REPORT OBJECTIVES**:
- Provide executive summary of innovation opportunities
- Present evidence-based design challenges and solutions  
- Offer clear recommendations for product development priorities
- Enable data-driven decision making for product teams

📊 **SYNTHESIS REQUIREMENTS**:
Transform the research and ideation work into a comprehensive strategic document:

**REPORT STRUCTURE**:
Generate a professional document with the following sections:

1. **Executive Summary**: Key insights and strategic recommendations
2. **Market Context**: {problem_domain} landscape and opportunities  
3. **Research Insights**: User needs and behavioral patterns discovered
4. **Design Challenges**: Prioritized problems with design rationale
5. **Product Concepts**: Detailed innovation roadmap with concepts
6. **Strategic Recommendations**: Next steps and implementation priorities

**CONTENT GUIDELINES**:
- **Professional Tone**: Executive-ready language and formatting
- **Data-Driven**: Support conclusions with specific evidence from research
- **Actionable**: Include concrete next steps and success metrics
- **Visual Structure**: Use clear headings and organized information hierarchy
- **Strategic Focus**: Emphasize business impact and user value creation

Context from all previous stages:
Problem Domain: {problem_domain}
Research Analysis: {analysis}
Design Challenges: {problem_statements}
Product Concepts: {product_ideas}
Chosen Solution: {chosen_solution}

     Return your response in the following format:
     {{
         "final_pdf": {{
             "title": "{problem_domain} Innovation Analysis",
             "sections": {{
                 "domain_context": "Overview of the {problem_domain} context",
                 "analysis_summary": "Comprehensive analysis from Stage 1",
                 "problem_statements": [
                     {{
                         "problem": "Problem statement",
                         "explanation": "Detailed explanation"
                     }}
                     // ... all problems
                 ],
                 "product_ideas": [
                     {{
                         "idea": "Product idea",
                         "detailed_explanation": "Complete explanation"
                     }}
                     // ... all ideas
                 ]
             }},
             "conclusion": "Summary of the entire workflow and next steps in {problem_domain} context"
         }}
     }}

**QUALITY STANDARDS**:
- Each section should be 150-300 words of substantive, strategic content
- Include specific insights and recommendations rather than generic statements
- Maintain consistent professional formatting and clear information hierarchy
- Focus on actionable intelligence that drives product development decisions
    """
