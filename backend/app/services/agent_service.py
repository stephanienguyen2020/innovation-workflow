from llama_index.core.tools import QueryEngineTool
from llama_index.llms.gemini import Gemini
from llama_index.core import Settings
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import re
from google import genai

from app.constant.config import GEMINI_API_KEY, GEMINI_MODEL, CLAUDE_API_KEY, OPENAI_API_KEY


def get_provider_for_model(model_id: str) -> str:
    """Determine provider from model ID string."""
    if model_id.startswith("claude"):
        return "anthropic"
    elif model_id.startswith("gpt") or model_id.startswith("o1") or model_id.startswith("o3") or model_id.startswith("o4"):
        return "openai"
    return "google"


# Fallback models per provider — used when the primary model fails
FALLBACK_MODELS = {
    "google": "gemini-2.5-flash",
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4o",
}

# Fallback chain order per provider
FALLBACK_CHAIN = {
    "google": ["anthropic", "openai"],
    "anthropic": ["openai", "google"],
    "openai": ["google", "anthropic"],
}


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
                print(f"Using document analysis tool: {tool.metadata.name}")
                tool_result = await tool.acall("What is the content of the document? Provide a comprehensive summary.")

                print(f"Tool result length: {len(str(tool_result))}")
                if len(str(tool_result)) < 100:
                    print(f"Tool result preview: {str(tool_result)}")

                # Return a response object that mimics the expected interface
                class Response:
                    def __init__(self, response_text):
                        self.response = response_text
                        self.content = response_text

                return Response(str(tool_result))

            except Exception as e:
                print(f"Tool execution failed: {e}")
                import traceback
                traceback.print_exc()

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
        """Initialize the agent service with Gemini settings"""
        self.gemini_llm = None
        self.native_client = None
        self._claude_client = None
        self._openai_client = None

        if GEMINI_API_KEY:
            try:
                self.gemini_llm = Gemini(
                    model=GEMINI_MODEL,
                    api_key=GEMINI_API_KEY,
                    temperature=0.1,
                    safety_settings=[
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                    ]
                )
                self.native_client = genai.Client(api_key=GEMINI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize Gemini LLM: {e}")

        if CLAUDE_API_KEY:
            try:
                import anthropic
                self._claude_client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize Claude client: {e}")

        if OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=OPENAI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {e}")

        if not self.gemini_llm:
            raise ValueError("GEMINI_API_KEY is required for Gemini models")
        self.llm = self.gemini_llm
        Settings.llm = self.llm

    def get_llm(self):
        """Get the Gemini LLM instance"""
        return self.gemini_llm

    async def _call_claude(self, prompt: str, model: str) -> str:
        """Make a call to Claude API."""
        if not self._claude_client:
            raise ValueError("Claude API key not configured")
        import asyncio
        response = await asyncio.to_thread(
            self._claude_client.messages.create,
            model=model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    async def _call_openai(self, prompt: str, model: str) -> str:
        """Make a call to OpenAI API."""
        if not self._openai_client:
            raise ValueError("OpenAI API key not configured")
        import asyncio
        response = await asyncio.to_thread(
            self._openai_client.chat.completions.create,
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    async def _call_gemini(self, prompt: str, model: str) -> str:
        """Make a call to Gemini API."""
        response = self.native_client.models.generate_content(
            model=model,
            contents=prompt,
        )
        return response.text if hasattr(response, 'text') else str(response)

    async def _call_provider(self, prompt: str, provider: str, model: str) -> str:
        """Route a call to the correct provider."""
        if provider == "anthropic":
            return await self._call_claude(prompt, model)
        elif provider == "openai":
            return await self._call_openai(prompt, model)
        else:
            return await self._call_gemini(prompt, model)

    async def generate_json(self, prompt: str, context: Optional[Dict[str, Any]] = None, model_id: Optional[str] = None) -> str:
        """
        Single direct LLM call that returns JSON. No RAG/agent overhead.
        Supports Gemini, Claude, and OpenAI based on model_id.
        After 2 failures on the primary provider, falls back through the chain.
        """
        import asyncio

        formatted = prompt
        if context:
            try:
                formatted = prompt.format(**context)
            except KeyError as e:
                print(f"Warning: Missing context variable {e} in prompt template")

        active_model = model_id or GEMINI_MODEL
        primary_provider = get_provider_for_model(active_model)

        # Build the full provider chain: primary, then fallbacks
        providers_to_try = [(primary_provider, active_model)]
        for fb_provider in FALLBACK_CHAIN.get(primary_provider, []):
            providers_to_try.append((fb_provider, FALLBACK_MODELS[fb_provider]))

        last_error = None
        for chain_idx, (provider, model) in enumerate(providers_to_try):
            max_retries = 2
            delays = [5, 10]
            for attempt in range(max_retries):
                try:
                    raw = await self._call_provider(formatted, provider, model)
                    return self.extract_json_from_response(raw)
                except Exception as e:
                    last_error = e
                    print(f"LLM call failed ({provider}/{model}, attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        print(f"   Retrying in {delays[attempt]}s...")
                        await asyncio.sleep(delays[attempt])

            # If we exhausted retries for this provider, notify and try next
            if chain_idx < len(providers_to_try) - 1:
                next_provider, next_model = providers_to_try[chain_idx + 1]
                print(f"⚠️  {provider}/{model} failed {max_retries} times. Falling back to {next_provider}/{next_model}...")

        raise Exception(f"All LLM providers failed. Last error: {last_error}")

    async def _stream_from_provider(self, prompt: str, provider: str, model: str):
        """Stream text from a specific provider. Yields text chunks."""
        import asyncio

        if provider == "anthropic":
            if not self._claude_client:
                raise ValueError("Claude API key not configured")

            def _stream_claude():
                chunks = []
                with self._claude_client.messages.stream(
                    model=model,
                    max_tokens=8192,
                    messages=[{"role": "user", "content": prompt}],
                ) as stream:
                    for text in stream.text_stream:
                        chunks.append(text)
                return chunks

            chunks = await asyncio.to_thread(_stream_claude)
            for text in chunks:
                yield text

        elif provider == "openai":
            if not self._openai_client:
                raise ValueError("OpenAI API key not configured")

            def _stream_openai():
                chunks = []
                stream = self._openai_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        chunks.append(delta)
                return chunks

            chunks = await asyncio.to_thread(_stream_openai)
            for text in chunks:
                yield text

        else:
            # Gemini streaming
            response = self.native_client.models.generate_content_stream(
                model=model,
                contents=prompt,
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text

    async def generate_text_stream(self, prompt: str, model_id: Optional[str] = None):
        """
        Stream text from the selected provider. Yields text chunks.
        After 2 failures on the primary provider, falls back through the chain.
        Yields a special fallback_notice dict when switching providers.
        """
        import asyncio
        active_model = model_id or GEMINI_MODEL
        primary_provider = get_provider_for_model(active_model)

        # Build the full provider chain: primary, then fallbacks
        providers_to_try = [(primary_provider, active_model)]
        for fb_provider in FALLBACK_CHAIN.get(primary_provider, []):
            providers_to_try.append((fb_provider, FALLBACK_MODELS[fb_provider]))

        last_error = None
        for chain_idx, (provider, model) in enumerate(providers_to_try):
            max_retries = 2
            delays = [5, 10]
            for attempt in range(max_retries):
                try:
                    async for chunk in self._stream_from_provider(prompt, provider, model):
                        yield chunk
                    return  # Successfully streamed — done
                except Exception as e:
                    last_error = e
                    print(f"Stream failed ({provider}/{model}, attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delays[attempt])

            # Exhausted retries for this provider — notify and try next
            if chain_idx < len(providers_to_try) - 1:
                next_provider, next_model = providers_to_try[chain_idx + 1]
                notice = f"⚠️ {provider} model failed. Switching to {next_model}..."
                print(notice)
                yield {"fallback_notice": notice}

        raise Exception(f"All LLM providers failed to stream. Last error: {last_error}")

    def extract_json_from_response(self, response_text: str) -> str:
        """
        Extract JSON from LLM response text, handling various formats.
        """
        if not response_text:
            return "{}"

        cleaned_text = response_text.strip()

        # Remove JavaScript-style comments from JSON
        cleaned_text = re.sub(r'//.*?$', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'/\*.*?\*/', '', cleaned_text, flags=re.DOTALL)

        # Try to find JSON in the response
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned_text, re.DOTALL)
        if json_match:
            extracted = json_match.group(1).strip()
            try:
                json.loads(extracted)
                return extracted
            except json.JSONDecodeError:
                pass

        # Look for JSON objects that start with { and end with }
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
                for j in range(i+1, len(lines)+1):
                    candidate = '\n'.join(lines[i:j])
                    try:
                        json.loads(candidate)
                        return candidate
                    except json.JSONDecodeError:
                        continue

        print(f"Warning: Could not extract valid JSON from response: {cleaned_text[:200]}...")
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
            llm = self.get_llm()
            agent = SimpleAgentWrapper(llm=llm, tools=tools)
            return agent
        except Exception as e:
            print(f"Agent creation failed: {e}")
            raise

    async def run_analysis(self, agent, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Run analysis using the agent and return the result.
        """
        formatted_query = query
        if context:
            try:
                formatted_query = query.format(**context)
            except KeyError as e:
                print(f"Warning: Missing context variable {e} in prompt template")
                formatted_query = query

        # For structured JSON output, use direct LLM approach
        if "Return ONLY valid JSON" in formatted_query or "{{" in formatted_query:
            print("Getting document content...")
            doc_query = "What is the content of the document? Provide a comprehensive summary."
            doc_response = await agent.achat(doc_query)
            doc_content = doc_response.response if hasattr(doc_response, 'response') else str(doc_response)

            print(f"Document content preview: {doc_content[:150]}...")

            enhanced_prompt = f"""
Based on the following document content, {formatted_query}

DOCUMENT CONTENT:
{doc_content}

Please analyze this specific document content and provide your response in the exact JSON format requested above.
"""

            llm_response = await agent.llm.acomplete(enhanced_prompt)
            raw_response = llm_response.text if hasattr(llm_response, 'text') else str(llm_response)

            response_text = self.extract_json_from_response(raw_response)

            try:
                json.loads(response_text)
                print(f"Successfully extracted and validated JSON from LLM response")
            except json.JSONDecodeError as e:
                print(f"Warning: Extracted text is not valid JSON: {e}")
                print(f"Raw response: {raw_response[:300]}...")
                print(f"Extracted: {response_text[:300]}...")
                response_text = raw_response

        else:
            response = await agent.achat(formatted_query)
            if hasattr(response, 'response'):
                response_text = response.response
            elif hasattr(response, 'content'):
                response_text = response.content
            else:
                response_text = str(response)

        return response_text

    async def run_analysis_stream(
        self, agent, query: str, context: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        formatted_query = query
        if context:
            try:
                formatted_query = query.format(**context)
            except KeyError as e:
                print(f"Warning: Missing context variable {e} in prompt template")

        yield {"event": "status", "data": {"message": "Reading document content..."}}

        doc_response = await agent.achat("What is the content of the document? Provide a comprehensive summary.")
        doc_content = doc_response.response if hasattr(doc_response, 'response') else str(doc_response)

        yield {"event": "status", "data": {"message": "Generating analysis..."}}

        problem_domain = context.get("problem_domain", "the given domain") if context else "the given domain"
        streaming_prompt = f"""
Based on the following document content, analyze it to understand what it reveals about the {problem_domain} context.

DOCUMENT CONTENT:
{doc_content}

Provide a focused analysis (150-250 words) that:
1. Identifies what type of document this is
2. Explains the context relevant to {problem_domain}
3. Highlights specific problems or challenges that emerge
4. Suggests opportunities for innovation

Write the analysis as a single coherent paragraph. Do NOT use JSON formatting, markdown, or bullet points. Just write plain text.
"""

        full_text = ""
        try:
            response = await self.native_model.generate_content_async(
                streaming_prompt,
                stream=True,
            )
            async for chunk in response:
                try:
                    delta = chunk.text
                    if delta:
                        full_text += delta
                        yield {"event": "chunk", "data": {"text": delta}}
                except (ValueError, AttributeError):
                    continue
        except Exception as e:
            print(f"Native streaming failed ({e}), falling back to acomplete")
            llm_response = await agent.llm.acomplete(streaming_prompt)
            full_text = llm_response.text if hasattr(llm_response, 'text') else str(llm_response)
            yield {"event": "chunk", "data": {"text": full_text}}

        cleaned_text = full_text.strip()
        if cleaned_text.startswith('"') and cleaned_text.endswith('"'):
            cleaned_text = cleaned_text[1:-1]

        yield {"event": "done", "data": {"analysis": cleaned_text}}

# Create singleton instance
agent_service = AgentService()
