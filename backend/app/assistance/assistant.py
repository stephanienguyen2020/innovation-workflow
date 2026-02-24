# Created: dylannguyen
import json
import os
from app.constant.assistant import INSTRUCTION
from app.constant.config import GEMINI_MODEL, GEMINI_API_KEY

class Assistant:
    assistant_id = None
    functions = {"functions":[]}
    registered_functions = {}
    instruction = INSTRUCTION
    
    def __init__(self):
        self.name = "Zelta"
        
        if Assistant.assistant_id:
            self.update_assistant(
                assistant_id=Assistant.assistant_id,
                instruction=Assistant.instruction,
                name=self.name,
                tools=Assistant.functions['functions']
            )
            self.retrieve_assistant(assistant_id=Assistant.assistant_id)
        else:
            self.create_assistant(
                name = self.name,
                instructions= Assistant.instruction,
                tools= Assistant.functions['functions']
            )
        
    def create_assistant(self, name, instructions, tools):
        Assistant.assistant_id = Assistant.assistant_id or "gemini_assistant"
        return {
            "id": Assistant.assistant_id,
            "name": name,
            "instructions": instructions,
            "tools": tools,
            "model": GEMINI_MODEL,
            "api_key_set": bool(GEMINI_API_KEY)
        }

    def retrieve_assistant(self, assistant_id):
        return {
            "id": assistant_id,
            "name": self.name,
            "instructions": Assistant.instruction,
            "tools": Assistant.functions["functions"],
            "model": GEMINI_MODEL,
            "api_key_set": bool(GEMINI_API_KEY)
        }

    def update_assistant(self, assistant_id, instruction, name, tools):
        Assistant.assistant_id = assistant_id
        Assistant.instruction = instruction
        return {
            "id": assistant_id,
            "name": name,
            "instructions": instruction,
            "tools": tools,
            "model": GEMINI_MODEL,
            "api_key_set": bool(GEMINI_API_KEY)
        }

    def list_memories(self):
        """
        Load information the model has to remember
        """
        assistant_dir = os.path.dirname(os.path.abspath(__file__))
        memory_json_path = os.path.join(assistant_dir, '../database/memory.json')
        with open(memory_json_path, 'r') as f:
            data = json.load(f)
        memory_titles = [memory['title'] for memory in data]
        return memory_titles 
     
    @classmethod
    def add_func(cls, func):
        '''
        Refers to the class.
        Used in class methods.
        Allows access to class variables, class methods, and can modify the class itself.
        cls refers to the Assistant class, not an instance of it.
        '''
        cls.registered_functions[func.__name__] = func
        doc_lines = func.__doc__.strip().split("\n")
        func_info = {
        'type': 'function',
        'function': {
            'name': func.__name__,
            'description': doc_lines[0].strip(),
            'parameters': {
                'type': 'object',
                'properties': {
                    k.strip(): {
                        'type': v.strip().split(':')[0].strip(), 
                        'description': v.strip().split(':')[1].strip()
                    } for k, v in (line.split(':', 1) for line in doc_lines[1:])
                },
                'required': [k.strip() for k, v in (line.split(':', 1) for line in doc_lines[1:])]}}
        }
        cls.functions["functions"].append(func_info)

# @Assistant.add_func
# def save_as_memory(title, content):
#     """
#     Save a small data asa memory to remember for future chats
#     title : string : title for memory
#     content : string : memory content
#     """
#     data = []
#     assistant_dir = os.path.dirname(os.path.abspath(__file__))
#     memory_json_path = os.path.join(assistant_dir, '../database/memory.json')
#     if os.path.isfile(memory_json_path):
#         with open(memory_json_path, 'r') as file:
#             data = json.load(file)
#         data.append({"title": title, "memory":content})
#     with open(memory_json_path, 'w') as file:
#         json.dump(data, file, indent = 4)
#         return 'memory saved successfully'
    
# @Assistant.add_func
# def delete_memory(title):
#     """
#     Delete a memory by its title
#     title: string: title of the memory to delete
#     """
#     assistant_dir = os.path.dirname(os.path.abspath(__file__))
#     memory_json_path = os.path.join(assistant_dir, '../database/memory.json')
#     if os.path.isfile(memory_json_path):
#         with open(memory_json_path, 'r') as file:
#             data = json.load(file)
#         with open(memory_json_path, 'w') as file:
#             updated_data = [memory for memory in data if memory["title"] != title]
#             json.dump(updated_data, file, indent=4)
#         return f"memory with title '{title}' delete"
#     return "file not found"

# @Assistant.add_func
# def get_memory(title):
#     """
#     Retrieve a memory by its title
#     title : string : title of the memory to retrieve
#     """
#     assistant_dir = os.path.dirname(os.path.abspath(__file__))
#     memory_json_path = os.path.join(assistant_dir, '../database/memory.json')
#     if os.path.isfile(memory_json_path):
#         with open(memory_json_path, 'r') as file:
#             data = json.load(file)
#         for memory in data:
#             if memory['title'] == title:
#                 return memory['memory']
#     return "memory not found"

# @Assistant.add_func
# def update_memory(title, new_memory):
    # """
    # Update a memory by its title
    # title : string : title of the memory to update
    # new_memory : string : new memory or updated memory text
    # """
    # assistant_dir = os.path.dirname(os.path.abspath(__file__))
    # memory_json_path = os.path.join(assistant_dir, '../database/memory.json')
    # if os.path.isfile(memory_json_path):
    #     with open(memory_json_path, 'r') as file:
    #         data = json.load(file)
        
    #     for memory in data:
    #         if memory['title'] == title:
    #             memory['memory']==new_memory
    #             data.remove(memory)
    #             data.append({
    #                 "title": title,
    #                 "memory": new_memory
    #             })
    #             with open(memory_json_path, 'w') as file:
    #                 json.dump(data, file, indent=4)
    #             print(f"memory with title '{title}' updated")
    #             return f"memory with title '{title}' updated"
        
    #     return "memory not found"

# @Assistant.add_func
# def get_current_date_time():
#     """
#         get today's date and time in format Weekday Thu Month Date HH:MM:SS and always time format is in 12 hours
#     """
#     from datetime import datetime
#     now = datetime.now()
#     formatted_datetime = now.strftime("%d/%m/%Y, %H:%M:%S")
#     return formatted_datetime
