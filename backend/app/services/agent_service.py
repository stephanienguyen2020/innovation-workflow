from llama_index.core.tools import QueryEngineTool
from llama_index.llms.openai import OpenAI
from llama_index.core import Settings
from typing import List, Dict, Any, Optional
import json
import re

from app.constant.config import OPENAI_API_KEY, OPENAI_MODEL

class SimpleAgentWrapper:
    """
    A simple wrapper that provides agent-like functionality without deprecated components.
    """
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.tool_map = {tool.metadata.name: tool for tool in tools}
    
    async def achat(self, message: str):
        """
        Simulate agent chat by using tools when needed and LLM for responses.
        """
        # Always try to use the document analysis tool first for any query
        # This ensures we get actual document content
        if self.tools:
            tool = self.tools[0]
            try:
                # Execute the tool with a query to get document content
                print(f"🔍 Using document analysis tool: {tool.metadata.name}")
                tool_result = await tool.acall("What is the content of the document? Provide a comprehensive summary.")
                
                # Return a response object that mimics the expected interface
                class Response:
                    def __init__(self, response_text):
                        self.response = response_text
                        self.content = response_text
                
                return Response(str(tool_result))
                
            except Exception as e:
                print(f"❌ Tool execution failed: {e}")
                # Fallback to direct LLM response
                llm_response = await self.llm.acomplete(message)
                class Response:
                    def __init__(self, response_text):
                        self.response = response_text
                        self.content = response_text
                return Response(llm_response.text if hasattr(llm_response, 'text') else str(llm_response))
        
        # If no tools available, use LLM directly
        llm_response = await self.llm.acomplete(message)
        class Response:
            def __init__(self, response_text):
                self.response = response_text
                self.content = response_text
        return Response(llm_response.text if hasattr(llm_response, 'text') else str(llm_response))

class AgentService:
    def __init__(self):
        """Initialize the agent service with OpenAI settings"""
        self.llm = OpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY
        )
        Settings.llm = self.llm
    
    def extract_json_from_response(self, response_text: str) -> str:
        """
        Extract JSON from LLM response text, handling various formats.
        
        Args:
            response_text: Raw response from LLM
            
        Returns:
            Cleaned JSON string
        """
        if not response_text:
            return "{}"
            
        # Clean the response text
        cleaned_text = response_text.strip()
        
        # Remove JavaScript-style comments from JSON
        cleaned_text = re.sub(r'//.*?$', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'/\*.*?\*/', '', cleaned_text, flags=re.DOTALL)
        
        # Try to find JSON in the response
        # Look for JSON blocks marked with ```json or just ```
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned_text, re.DOTALL)
        if json_match:
            extracted = json_match.group(1).strip()
            try:
                json.loads(extracted)
                return extracted
            except json.JSONDecodeError:
                pass
        
        # Look for JSON objects that start with { and end with } (greedy match)
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            extracted = json_match.group(0).strip()
            try:
                json.loads(extracted)
                return extracted
            except json.JSONDecodeError:
                pass
        
        # Try to find properly balanced braces
        brace_count = 0
        start_index = cleaned_text.find('{')
        if start_index != -1:
            for i, char in enumerate(cleaned_text[start_index:], start_index):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        extracted = cleaned_text[start_index:i+1]
                        try:
                            json.loads(extracted)
                            return extracted
                        except json.JSONDecodeError:
                            break
        
        # If no JSON found, try to parse the entire response
        try:
            json.loads(cleaned_text)
            return cleaned_text
        except json.JSONDecodeError:
            pass
        
        # Last resort: try to extract from lines that look like JSON
        lines = cleaned_text.split('\n')
        for i, line in enumerate(lines):
            if line.strip().startswith('{'):
                # Try to combine this line with subsequent lines until we get valid JSON
                for j in range(i+1, len(lines)+1):
                    candidate = '\n'.join(lines[i:j])
                    try:
                        json.loads(candidate)
                        return candidate
                    except json.JSONDecodeError:
                        continue
        
        # If all else fails, return the original response
        print(f"⚠️ Warning: Could not extract valid JSON from response: {cleaned_text[:200]}...")
        return cleaned_text
        
    def create_query_engine_tool(self, query_engine, name: str, description: str) -> QueryEngineTool:
        """Create a query engine tool for the agent"""
        return QueryEngineTool.from_defaults(
            query_engine=query_engine,
            name=name,
            description=description
        )

    def create_document_analysis_tools(self, query_engine, stage_number: int) -> List[QueryEngineTool]:
        """
        Create tools for document analysis based on the stage.
        
        Args:
            query_engine: The query engine to use
            stage_number: The stage number (1-4)
            
        Returns:
            List of tools for the agent
        """
        tool_configs = {
            1: {
                "name": "analyze_document",
                "description": "Use this tool to read and analyze the content of the uploaded document. Returns the document's content and key information."
            },
            2: {
                "name": "retrieve_document_content",
                "description": "Use this tool to retrieve and analyze the document content to identify potential problems and challenges mentioned or implied in the text."
            },
            3: {
                "name": "get_document_context",
                "description": "Use this tool to get document content and context to help generate relevant product ideas based on the identified problems."
            },
            4: {
                "name": "get_full_document",
                "description": "Use this tool to access the complete document content for creating the final comprehensive report."
            }
        }
        
        config = tool_configs.get(stage_number, {
            "name": "document_analysis",
            "description": "Analyzes the document content."
        })
        
        return [
            self.create_query_engine_tool(
                query_engine=query_engine,
                **config
            )
        ]
        
    def create_agent(self, tools):
        """Create a simple agent-like interface using tools and LLM"""
        try:
            # Create a simple agent wrapper that can handle tool calls
            agent = SimpleAgentWrapper(llm=self.llm, tools=tools)
            return agent
        except Exception as e:
            print(f"❌ Agent creation failed: {e}")
            raise
        
    async def run_analysis(self, agent, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Run analysis using the agent and return the result.
        
        Args:
            agent: The agent to use
            query: The query to run
            context: Optional context data to include
            
        Returns:
            Analysis result
        """
        # Format the query template with context variables if provided
        formatted_query = query
        if context:
            try:
                formatted_query = query.format(**context)
            except KeyError as e:
                print(f"⚠️ Warning: Missing context variable {e} in prompt template")
                formatted_query = query
        
        # For structured JSON output, use direct LLM approach
        if "Return ONLY valid JSON" in formatted_query or "{{" in formatted_query:
            # Get document context first
            print("📄 Getting document content...")
            doc_query = "What is the content of the document? Provide a comprehensive summary."
            doc_response = await agent.achat(doc_query)
            doc_content = doc_response.response if hasattr(doc_response, 'response') else str(doc_response)
            
            print(f"📄 Document content preview: {doc_content[:150]}...")
            
            # Create a comprehensive prompt that includes the document content
            enhanced_prompt = f"""
Based on the following document content, {formatted_query}

DOCUMENT CONTENT:
{doc_content}

Please analyze this specific document content and provide your response in the exact JSON format requested above.
"""
            
            llm_response = await self.llm.acomplete(enhanced_prompt)
            raw_response = llm_response.text if hasattr(llm_response, 'text') else str(llm_response)
            
            # Extract and clean JSON from the response
            response_text = self.extract_json_from_response(raw_response)
            
            # Validate that we have valid JSON
            try:
                json.loads(response_text)
                print(f"✅ Successfully extracted and validated JSON from LLM response")
            except json.JSONDecodeError as e:
                print(f"⚠️ Warning: Extracted text is not valid JSON: {e}")
                print(f"Raw response: {raw_response[:300]}...")
                print(f"Extracted: {response_text[:300]}...")
                # Return the original response if extraction fails
                response_text = raw_response
                
        else:
            # Use FunctionCallingAgent for conversational tasks
            response = await agent.achat(formatted_query)
            if hasattr(response, 'response'):
                response_text = response.response
            elif hasattr(response, 'content'):
                response_text = response.content
            else:
                response_text = str(response)
            
        return response_text

# Create singleton instance
agent_service = AgentService() 