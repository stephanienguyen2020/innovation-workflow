from llama_index.core.tools import QueryEngineTool
from llama_index.llms.openai import OpenAI
from llama_index.core import Settings
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.workflow import Context
from typing import List, Dict, Any, Optional

from app.constant.config import OPENAI_API_KEY

class AgentService:
    def __init__(self):
        """Initialize the agent service with OpenAI settings"""
        self.llm = OpenAI(
            model="gpt-4",
            api_key=OPENAI_API_KEY
        )
        Settings.llm = self.llm
        
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
        """Create a function agent with the given tools"""
        return FunctionAgent(tools=tools, llm=self.llm)
        
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
        ctx = Context(agent)
        
        # Set each context key-value pair in the Context object
        if context:
            for key, value in context.items():
                await ctx.set(key, value)
                
        response = await agent.run(query, ctx=ctx)
        return str(response)

# Create singleton instance
agent_service = AgentService() 