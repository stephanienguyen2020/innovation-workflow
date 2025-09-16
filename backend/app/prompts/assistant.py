class ProjectPrompts:
    STAGE_1_ANALYSIS = """
{{% chat role="system" %}}
You are an expert product designer who understands user problems and their contexts. 
You analyze documents to identify relevant insights and problems specific to the domain they relate to.
{{% endchat %}}

**MISSION**: Analyze the provided document to understand what it reveals about the {problem_domain} context and identify specific problems or challenges that could be addressed.

**ANALYSIS APPROACH**:
Based on the problem domain "{problem_domain}", adapt your analysis to the document type:

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

There might be more types of documents, you need to analyze the document and identify the type of document and the context of the document. Above are just some of the types of documents.

**ANALYSIS FOCUS**:
1. **Document Context**: What type of document is this and what does it tell us?
2. **Key Insights**: What specific information can we extract?
3. **Relevant Problems**: What challenges or problems in the {problem_domain} space does this document reveal or suggest?
4. **Opportunities**: What specific areas could be improved or addressed?

Return ONLY valid JSON in this exact format:
{{
    "analysis": {{
        "content": "Your focused analysis (150-250 words) that identifies what type of document this is, explains the context relevant to {problem_domain}, highlights specific problems or challenges that emerge, and suggests opportunities. Keep the analysis practical and directly related to the {problem_domain} context."
    }}
}}

**IMPORTANT FORMATTING RULES**:
- Return ONLY the JSON object above
- Do not include any explanatory text, markdown formatting, or code blocks
- The response must be pure JSON that can be parsed directly
- Stay focused on the actual content and context
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

**MISSION**: Transform the research analysis into precisely defined design challenges that will guide product innovation in the {problem_domain} space.

**CONTEXT**:
- **Domain**: {problem_domain}
- **Research Insights**: {analysis}

**DESIGN CHALLENGE IDENTIFICATION FRAMEWORK**:

Apply these product design methodologies to extract problem statements:

**1. User-Centered Problem Framing**:
- Focus on user pain points, frustrations, and unmet needs
- Consider different user personas and their unique challenges
- Think about emotional and functional job-to-be-done gaps

**2. Opportunity Prioritization Matrix**:
- **High Impact + High Feasibility**: Core product opportunities
- **High Impact + Medium Feasibility**: Innovation stretch goals  
- **Medium Impact + High Feasibility**: Quick wins and iterations
- **Emerging Opportunities**: Future-forward possibilities

**3. Problem Statement Quality Criteria**:
- **Specific**: Clearly defined user and context
- **Actionable**: Can be addressed through product design
- **Valuable**: Meaningful impact on user experience or business
- **Testable**: Can be validated through research/prototyping

**PROBLEM CATEGORIES TO CONSIDER**:
- **Usability & UX**: Interface, interaction, and experience friction
- **Accessibility & Inclusion**: Barriers for diverse user groups  
- **Efficiency & Productivity**: Workflow and process optimization
- **Emotional & Social**: Trust, status, connection, and satisfaction needs
- **Technology & Integration**: Platform limitations and technical gaps
- **Business Model**: Monetization, scalability, and market fit challenges

**OUTPUT REQUIREMENTS**:
Generate exactly 4 problem statements ranked by **design impact potential** (highest priority first).

**Problem Statement Formula**: 
"[User persona] need(s) a way to [accomplish goal] because [current barrier/pain point] prevents them from [desired outcome]"

Follow this Pydantic model structure exactly:

class ProblemStatement:
    problem: str  # Clear, user-centered problem statement using the formula above
    explanation: str  # Design rationale including user impact, business value, and implementation considerations

class Stage2Output:
    problem_statements: List[ProblemStatement]  # Exactly 4 prioritized problem statements

**DESIGN THINKING CRITERIA**:
1. **Empathy-Driven**: Based on real user needs from the analysis
2. **Design-Actionable**: Can be addressed through product/UX solutions  
3. **Impact-Ordered**: Ranked by potential to improve user experience
4. **Innovation-Focused**: Opportunities for differentiation and value creation
5. **Evidence-Based**: Directly supported by insights from the research analysis

Requirements:
1. Each problem statement must be unique and actionable
2. Each explanation must reference specific points from the analysis
3. Problems should be ordered by priority/impact
4. Use professional, clear language

Context from previous stage:
    Problem Domain: {problem_domain}
    Analysis: {analysis}

Return ONLY valid JSON matching the Pydantic model structure above:
{{
    "problem_statements": [
        {{
            "problem": "[User] needs a way to [goal] because [barrier] prevents [outcome]",
            "explanation": "Design rationale covering: user impact (why this matters to users), business value (market opportunity), feasibility considerations (implementation complexity), and supporting evidence from the analysis"
        }},
        // ... repeat for all 4 problems, ordered by design impact potential
    ]
}}
    """

    STAGE_3_IDEAS = """
{{% chat role="system" %}}
You are a senior product designer and innovation strategist specializing in {problem_domain}. 
You excel at transforming user problems into breakthrough product concepts using design thinking, lean startup methodology, and human-centered design principles.
Your goal is to create product ideas that are both innovative and viable for real-world implementation.
{{% endchat %}}

**MISSION**: Generate three distinct product concepts that address the identified design challenges through innovative, user-centered solutions in the {problem_domain} space. Using the analysis from Stage 1 and problem statements from Stage 2, 
generate exactly three product ideas that solve the identified problems.

**DESIGN CONTEXT**:
- **Domain**: {problem_domain}
- **Research Foundation**: {analysis}
- **Design Challenges**: {problem_statements}

**PRODUCT IDEATION FRAMEWORK**:

**IDEATION METHODOLOGY**:
Apply these proven design thinking techniques:

1. **How Might We (HMW) Exploration**: Reframe problems as opportunities
2. **Divergent Thinking**: Generate multiple solution approaches per problem
3. **Convergent Validation**: Select ideas with highest user impact potential
4. **Concept Synthesis**: Combine insights into coherent product visions

**INNOVATION PATTERNS TO EXPLORE**:
- **Simplification**: Remove complexity and friction from existing solutions
- **Integration**: Connect disparate services or experiences seamlessly  
- **Personalization**: Adapt experiences to individual user contexts
- **Accessibility**: Make solutions inclusive for diverse user capabilities
- **Automation**: Reduce cognitive load through intelligent assistance
- **Community**: Enable social connection and collaborative experiences
- **Data Intelligence**: Leverage insights to improve user outcomes
- **Platform Strategy**: Enable ecosystem and third-party innovation

**PRODUCT CONCEPT REQUIREMENTS**:

Generate exactly 3 product ideas with diverse solution approaches:
- **Concept 1**: Immediate impact solution (quick win, high feasibility)
- **Concept 2**: Platform/ecosystem solution (medium-term, scalable)  
- **Concept 3**: Breakthrough innovation (long-term vision, high differentiation)

**PRODUCT CONCEPT STRUCTURE**:
Each concept must include comprehensive design documentation:

class ProductIdea:
    idea: str  # Compelling product name and 1-sentence value proposition
    detailed_explanation: str  # Complete product specification with design rationale

**DETAILED EXPLANATION TEMPLATE**:
Your explanation should be structured as follows (300-400 words), with each section clearly separated by line breaks:

**Problem-Solution Fit**: Which specific problem(s) this addresses and how

**Target Users**: Primary user personas and use cases

**Core Product Experience**: Key features, user journey, and interaction design

**Technical Approach**: High-level architecture and implementation strategy

**Business Model**: Revenue strategy and market positioning

**Competitive Advantage**: Unique value proposition and differentiation

**Validation Strategy**: How to test and iterate on the concept

**Success Metrics**: Key performance indicators for product success

**Implementation Roadmap**: Phased rollout strategy (MVP → Full Product)

IMPORTANT: Ensure each section header (**Section Name**:) is followed by a line break, and add a blank line between each section for proper formatting.

**DESIGN EXCELLENCE CRITERIA**:
1. **User-Centricity**: Deeply addresses real user needs and pain points
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
            "detailed_explanation": "**Problem-Solution Fit**: Comprehensive explanation of how this addresses the specific problem(s)\\n\\n**Target Users**: Description of primary user personas and use cases\\n\\n**Core Product Experience**: Details of key features, user journey, and interaction design\\n\\n**Technical Approach**: High-level architecture and implementation strategy\\n\\n**Business Model**: Revenue strategy and market positioning\\n\\n**Competitive Advantage**: Unique value proposition and differentiation\\n\\n**Validation Strategy**: How to test and iterate on the concept\\n\\n**Success Metrics**: Key performance indicators for product success\\n\\n**Implementation Roadmap**: Phased rollout strategy (MVP → Full Product)"
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
