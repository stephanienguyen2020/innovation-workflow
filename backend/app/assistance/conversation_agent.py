# Created: dylannguyen
from app.assistance.assistant import Assistant


class Conversation_Agent:
    def __init__(self, name="conversation_agent"):
        self.name = name
        self.instructions = Assistant.instruction
        self.tools = Assistant.functions["functions"]
        self.registered_functions = Assistant.registered_functions

    def register_function(self, functions):
        self.registered_functions.update(functions)

    def add_context_handler(self):
        return _ContextHandler()


class _ContextHandler:
    def add_to_agent(self, agent):
        return None


singleton_conversation_agent = Conversation_Agent(name="conversation_agent")


def get_conversation_agent() -> Conversation_Agent:
    return singleton_conversation_agent
