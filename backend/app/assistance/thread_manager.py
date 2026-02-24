# Created: dylannguyen
from fastapi import HTTPException, status
import json
import uuid

class ThreadManager:
    def __init__(self, session: dict):
        self.thread = None
        self.session = session

    async def create_thread(self):
        try:
            if 'thread_id' not in self.session:
                thread_id = str(uuid.uuid4())
                self.session['thread_id'] = thread_id
                self.session.setdefault('messages', [])
                self.thread = {"id": thread_id}
            else:
                self.retrieve_thread(thread_id= self.session['thread_id'])
        except KeyError:
            thread_id = str(uuid.uuid4())
            self.session['thread_id'] = thread_id
            self.session.setdefault('messages', [])
            self.thread = {"id": thread_id}
    
    def retrieve_thread(self, thread_id):
        if self.session.get('thread_id') == thread_id:
            self.thread = {"id": thread_id}
            self.session.setdefault('messages', [])
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found"
            )

    def add_message_to_thread(self, role, content):
        if self.thread:
            self.session.setdefault('messages', []).append({
                "role": role,
                "content": content
            })

    def get_last_message(self):
        messages = self.session.get('messages', [])
        if not messages:
            return None
        return messages[-1].get("content")

    def get_messages(self):
        return self.session.get('messages', [])[:100]
    
    def run_assistant(self, assistant_id):
        if not self.thread:
            raise HTTPException(
                status_code= status.HTTP_400_BAD_REQUEST, 
                detail="Thread not created")
        return self.get_last_message()

    def call_required_functions(self, run, tool_calls):
        # Define the list to store tool outputs
        tool_outputs = []
        
        # Loop through each tool in the required action section
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_to_call = self.session.get("registered_functions", {}).get(function_name)
            if function_to_call:
                function_args = json.loads(tool_call.function.arguments)
                function_response = function_to_call(**function_args)
                tool_outputs.append(
                    {
                        "tool_call_id": tool_call.id, 
                        "output": function_response
                    }
                )
        return tool_outputs
