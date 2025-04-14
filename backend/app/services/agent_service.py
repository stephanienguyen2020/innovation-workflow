from llama_index.core.tools import QueryEngineTool
from llama_index.llms.openai import OpenAI
from llama_index.core import Settings
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.core.workflow import Context

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
        
    def create_agent(self, tools):
        """Create a function agent with the given tools"""
        return FunctionAgent(tools=tools, llm=self.llm)
        
    async def run_analysis(self, agent, query: str) -> str:
        """Run analysis using the agent and return the result"""
        ctx = Context(agent)
        response = await agent.run(query, ctx=ctx)
        return str(response)

# Create singleton instance
agent_service = AgentService() 