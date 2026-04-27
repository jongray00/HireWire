#!/usr/bin/env python3
"""
Sally Sales AI Agent Backend - Multi-Employee Support

This backend serves multiple SWML agents, one for each virtual employee.
Each employee has their own configuration and SWML endpoint.
"""

import os
import uuid
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from signalwire_agents import AgentBase, SwaigFunctionResult
from fastapi import FastAPI, Request, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Load environment variables from .env file
load_dotenv()

# Load credentials and domain from .env
SWML_USER = os.getenv('SWML_BASIC_AUTH_USER', 'signalwire')
SWML_PASSWORD = os.getenv('SWML_BASIC_AUTH_PASSWORD', 'signalwire')
APP_DOMAIN = os.getenv('APP_DOMAIN', '')


def _detect_ngrok_url() -> Optional[str]:
    """Query ngrok local API to get the current public tunnel URL."""
    try:
        import urllib.request
        resp = urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2)
        data = json.loads(resp.read())
        for tunnel in data.get("tunnels", []):
            if tunnel.get("proto") == "https":
                return tunnel["public_url"]
    except Exception:
        pass
    return None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global storage for agent credentials
agent_credentials = {
    "username": SWML_USER,
    "password": SWML_PASSWORD,
    "app_domain": APP_DOMAIN
}

# Global storage for employee configurations
# Key: employee_id, Value: employee config dict
employees: Dict[str, Dict[str, Any]] = {}

# Global storage for agent instances
# Key: employee_id, Value: Agent instance
agent_instances: Dict[str, AgentBase] = {}


class VirtualEmployeeAgent(AgentBase):
    """Dynamic AI agent for a virtual employee"""

    def __init__(self, employee_config: Dict[str, Any]):
        self.employee_id = employee_config['id']
        self.employee_config = employee_config

        # Initialize agent with employee-specific route
        super().__init__(
            name=employee_config.get('name', 'Employee'),
            route=f"/swml/{self.employee_id}"
        )

        # Configure voice and language
        voice = employee_config.get('voice', 'openai.nova')
        language_code = employee_config.get('language', 'en-US')
        language_name = self._get_language_name(language_code)

        self.add_language(
            name=language_name,
            code=language_code,
            voice=voice,
            speech_fillers=[
                "Let me help you with that...",
                "One moment please...",
                "I'm processing your request..."
            ],
            function_fillers=[
                "Let me check on that for you...",
                "I'm looking that up now..."
            ]
        )

        # Speech recognition hints — wired through add_hints so they reach SWML
        speech_hints = employee_config.get('speech_hints') or []
        if not isinstance(speech_hints, list):
            speech_hints = []
        if not speech_hints:
            speech_hints = ["help", "support", "agent", "representative"]
        self.add_hints([h for h in speech_hints if isinstance(h, str) and h])

        # Configure personality
        self._update_personality()

        # Configure post-prompt for call analytics
        self._configure_post_prompt()

        # Add enabled functions
        self._configure_functions()

    def _get_language_name(self, code: str) -> str:
        """Get language name from code"""
        lang_map = {
            'en': 'English', 'en-US': 'English', 'en-GB': 'English',
            'en-AU': 'English', 'en-IN': 'English', 'en-NZ': 'English',
            'es': 'Spanish', 'es-ES': 'Spanish', 'es-419': 'Spanish',
            'fr': 'French', 'fr-FR': 'French', 'fr-CA': 'French',
            'de': 'German', 'de-DE': 'German',
            'it': 'Italian', 'it-IT': 'Italian',
            'pt': 'Portuguese', 'pt-BR': 'Portuguese', 'pt-PT': 'Portuguese',
            'ja': 'Japanese', 'ja-JP': 'Japanese',
            'zh': 'Chinese', 'zh-CN': 'Chinese',
            'ko': 'Korean', 'ko-KR': 'Korean',
            'hi': 'Hindi',
            'ru': 'Russian',
            'nl': 'Dutch',
            'pl': 'Polish',
            'sv': 'Swedish', 'sv-SE': 'Swedish',
            'da': 'Danish', 'da-DK': 'Danish',
            'tr': 'Turkish',
            'vi': 'Vietnamese',
            'uk': 'Ukrainian',
            'multi': 'Multilingual',
        }
        return lang_map.get(code, 'English')

    def _update_personality(self):
        """Update agent personality from employee config using POM sections"""
        name = self.employee_config.get('name', 'Assistant')
        role = self.employee_config.get('role', 'Virtual Assistant')
        greeting = self.employee_config.get('greeting', f'Hello, I am {name}.')
        prompt = self.employee_config.get('prompt', '')

        # Identity section
        self.prompt_add_section(
            "Identity",
            body=f"You are {name}, a {role}. Your greeting is: \"{greeting}\""
        )

        # Main instructions from the user's prompt (may contain markdown sections)
        if prompt:
            self.prompt_add_section("Instructions", body=prompt)

        # Voice interaction guidelines
        guidelines = [
            "Keep responses to 1-3 sentences — this is a phone call, not a text chat",
            "Be conversational and natural, not robotic",
            "Listen fully before responding",
            "If you are unsure about something, say so and offer to connect the caller with a human",
            "Always end interactions with a clear next step",
        ]

        # Add SMS offer guideline if send_summary_sms is enabled
        enabled_functions = self.employee_config.get('enabled_functions', [])
        if 'send_summary_sms' in enabled_functions:
            guidelines.append(
                "Before ending the call, ask the caller if they would like a summary sent to their phone via text message. "
                "If yes, ask for their phone number, then use the send_summary_sms function."
            )

        self.prompt_add_section(
            "Voice Interaction Guidelines",
            bullets=guidelines
        )

        # Set temperature
        temperature = self.employee_config.get('temperature', 0.7)
        self.set_param("temperature", temperature)

    def _configure_post_prompt(self):
        """Configure post-prompt to generate a structured call summary"""
        self.set_post_prompt(
            "Summarize this conversation as JSON with exactly these fields:\n"
            '- "summary": 2-3 sentence summary of the call\n'
            '- "caller_intent": what the caller wanted (1 sentence)\n'
            '- "outcome": one of "resolved", "transferred", "abandoned", or "follow_up_needed"\n'
            '- "sentiment": one of "positive", "neutral", or "negative"\n'
            '- "topics": array of topic keyword strings\n'
            '- "follow_up": any action items or follow-up needed (null if none)\n'
            "Respond ONLY with the JSON object, no extra text."
        )

    def _configure_functions(self):
        """Configure which functions are enabled for this employee"""
        enabled_functions = self.employee_config.get('enabled_functions', [])
        logger.info(f"Employee {self.employee_id} enabled functions: {enabled_functions}")

        kb_tool_names = set()
        if 'search_knowledge' in enabled_functions:
            kb_tool_names = self._configure_knowledge_base()

        # Remove SWAIG tools not in the enabled list. `search_knowledge` is a meta-flag;
        # the real RAG tools are named per-document (search_<slug>) and tracked separately.
        keep = {f for f in enabled_functions if f != 'search_knowledge'} | kb_tool_names
        if enabled_functions:
            all_functions = list(self._tool_registry.get_all_functions().keys())
            for func_name in all_functions:
                if func_name not in keep:
                    self._tool_registry.remove_function(func_name)
                    logger.info(f"  Removed function '{func_name}' (not in enabled list)")

    def _configure_knowledge_base(self):
        """Wire up knowledge-base search skills. Returns the set of registered tool names.

        Each document gets its own tool with a unique `tool_name`, a description the LLM
        uses to route queries, and per-document tuning params. Two backends are supported:
        - `datasphere` (default): serverless, runs on SignalWire infrastructure
        - `local`: native_vector_search (sqlite index_file or pgvector)
        """
        documents = self.employee_config.get('documents') or []
        if not documents:
            logger.info(f"[{self.employee_id}] search_knowledge enabled but no documents configured")
            self.employee_config['knowledge_status'] = 'no_documents'
            return set()

        space_name = os.getenv('SIGNALWIRE_SPACE', '') or self.employee_config.get('space_name', '')
        project_id = os.getenv('SIGNALWIRE_PROJECT_ID', '') or self.employee_config.get('project_id', '')
        token = os.getenv('SIGNALWIRE_TOKEN', '') or self.employee_config.get('token', '')

        default_no_results = self.employee_config.get(
            'kb_no_results_message',
            "I couldn't find that in our documentation. "
            "Would you like me to connect you with someone who can help?"
        )
        language_code = self.employee_config.get('language', 'en-US')
        default_fillers = {language_code: [
            "Let me check our documentation...",
            "Searching our knowledge base...",
            "One moment while I look that up...",
        ]}

        registered = set()
        routing_entries = []
        speech_terms = set()
        credential_issue = False

        for idx, doc in enumerate(documents):
            if isinstance(doc, str):
                doc = {"document_id": doc}
            if not isinstance(doc, dict):
                continue

            doc_id = doc.get('document_id') or ''
            backend = (doc.get('backend') or 'datasphere').lower()
            name = doc.get('name') or doc.get('slug') or (doc_id[:8] if doc_id else f"kb_{idx}")
            tool_name = doc.get('tool_name') or self._safe_tool_name(name, idx)
            description = doc.get('description') or f"Search the {name} knowledge base for relevant information"
            count = int(doc.get('count') or 3)
            distance = float(doc.get('distance') or 3.0)
            tags = doc.get('tags') or None
            language = doc.get('language') or None
            pos_to_expand = doc.get('pos_to_expand') or None
            max_synonyms = doc.get('max_synonyms') or None
            no_results = doc.get('no_results_message') or default_no_results
            fillers = doc.get('fillers') or default_fillers

            # Feed KB name and tags into STT hints so domain jargon transcribes correctly
            if name:
                speech_terms.add(name)
            if tags:
                speech_terms.update(str(t) for t in tags if t)

            if backend == 'local':
                params = {
                    "tool_name": tool_name,
                    "description": description,
                    "count": count,
                    "no_results_message": no_results,
                    "swaig_fields": {"fillers": fillers},
                }
                if tags:
                    params["tags"] = tags
                connection_string = doc.get('connection_string', '')
                collection_name = doc.get('collection_name', '')
                index_file = doc.get('index_file', '')
                if connection_string and collection_name:
                    params["backend"] = "pgvector"
                    params["connection_string"] = connection_string
                    params["collection_name"] = collection_name
                elif index_file:
                    params["index_file"] = index_file
                else:
                    logger.warning(f"[{self.employee_id}] KB '{name}' backend=local but no index_file or pgvector config")
                    continue
                try:
                    self.add_skill("native_vector_search", params)
                    registered.add(tool_name)
                    routing_entries.append((tool_name, description))
                    logger.info(f"[{self.employee_id}] Added local KB '{name}' as tool '{tool_name}'")
                except Exception as e:
                    logger.error(f"[{self.employee_id}] Failed to add local KB '{name}': {e}")
                continue

            # DataSphere backend (default)
            if not (space_name and project_id and token):
                logger.warning(f"[{self.employee_id}] KB '{name}' needs DataSphere credentials (SIGNALWIRE_SPACE/PROJECT_ID/TOKEN)")
                credential_issue = True
                continue
            if not doc_id:
                logger.warning(f"[{self.employee_id}] KB '{name}' missing document_id — skipping")
                continue

            params = {
                "space_name": space_name,
                "project_id": project_id,
                "token": token,
                "document_id": doc_id,
                "tool_name": tool_name,
                "count": count,
                "distance": distance,
                "no_results_message": no_results,
                "swaig_fields": {"fillers": fillers},
            }
            if tags:
                params["tags"] = tags
            if language:
                params["language"] = language
            if pos_to_expand:
                params["pos_to_expand"] = pos_to_expand
            if max_synonyms:
                params["max_synonyms"] = max_synonyms

            try:
                self.add_skill("datasphere_serverless", params)
                registered.add(tool_name)
                routing_entries.append((tool_name, description))
                logger.info(f"[{self.employee_id}] Added DataSphere KB '{name}' ({doc_id}) as tool '{tool_name}'")
            except Exception as e:
                logger.error(f"[{self.employee_id}] Failed to add DataSphere KB '{name}': {e}")

        if registered:
            self.employee_config['knowledge_status'] = 'active'
        elif credential_issue:
            self.employee_config['knowledge_status'] = 'missing_credentials'
        else:
            self.employee_config['knowledge_status'] = 'no_documents'

        if len(routing_entries) > 1:
            bullets = [f"`{tn}` — {desc}" for tn, desc in routing_entries]
            self.prompt_add_section(
                "Knowledge Base Routing",
                body="You have multiple knowledge bases. Choose the one that best matches the user's question:",
                bullets=bullets,
            )
        elif len(routing_entries) == 1:
            tn, desc = routing_entries[0]
            self.prompt_add_section(
                "Knowledge Base",
                body=f"Use the `{tn}` tool to look up information. {desc}.",
            )

        if speech_terms:
            self.add_hints([t for t in speech_terms if t])

        return registered

    @staticmethod
    def _safe_tool_name(name, idx):
        """Turn a friendly KB name into a valid SWAIG tool name like 'search_product_docs'."""
        import re
        slug = re.sub(r'[^a-zA-Z0-9]+', '_', (name or '').strip().lower()).strip('_')
        slug = slug[:32] or f"kb_{idx}"
        return f"search_{slug}"

    # ------------------------------------------------------------------
    # SWAIG Functions — real actions via SwaigFunctionResult
    # ------------------------------------------------------------------

    @AgentBase.tool(
        name="transfer_to_human",
        description="Transfer the call to a human representative at a real phone number",
        parameters={
            "type": "object",
            "properties": {
                "department": {
                    "type": "string",
                    "description": "Department to transfer to (e.g. sales, support, general)"
                },
                "reason": {
                    "type": "string",
                    "description": "Brief reason for the transfer"
                }
            }
        }
    )
    def transfer_to_human(self, args, raw_data):
        """Transfer call to a configured phone number"""
        department = args.get("department", "general")
        reason = args.get("reason", "Requested human assistance")
        number = self.employee_config.get("transfer_number", "")

        logger.info(f"[{self.employee_id}] Transfer requested to {number or 'NO NUMBER'} - {department}: {reason}")

        if not number:
            result = SwaigFunctionResult(
                "I'm sorry, there's no transfer number configured right now. "
                "Let me take a message instead so someone can call you back."
            )
            return result

        result = SwaigFunctionResult(
            f"I'll connect you with our {department} team now. Please hold.",
            post_process=True
        )
        # Use transfer_from if set, otherwise fall back to assigned phone_number
        from_addr = self.employee_config.get("transfer_from") or self.employee_config.get("phone_number") or None
        result.connect(number, final=True, from_addr=from_addr)
        return result


    @staticmethod
    def _clean_phone_number(number: str) -> str:
        """Sanitize phone number to E.164 format — strip hyphens, spaces, parens."""
        import re
        if not number:
            return ""
        cleaned = re.sub(r'[^\d+]', '', number)
        if cleaned and not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        return cleaned

    @AgentBase.tool(
        name="send_summary_sms",
        description="Send an SMS text message to the caller's phone number. Can send call summaries, confirmations, follow-ups, or any custom message. Ask for their phone number first.",
        parameters={
            "type": "object",
            "properties": {
                "phone_number": {
                    "type": "string",
                    "description": "The caller's phone number to send the SMS to (E.164 format)"
                },
                "message": {
                    "type": "string",
                    "description": "The text message to send — can be a call summary, confirmation, or any relevant message"
                },
                "caller_info": {
                    "type": "string",
                    "description": "Caller name and contact info if provided"
                }
            },
            "required": ["phone_number", "message"]
        }
    )
    def send_summary_sms(self, args, raw_data):
        """Send an SMS with the call summary to a number the caller provided"""
        phone_number_raw = args.get("phone_number", "")
        message = args.get("message", "") or args.get("summary", "No message provided")
        caller_info = args.get("caller_info", "")
        from_number = self.employee_config.get("sms_from_number", "")

        # Sanitize phone number to clean E.164
        phone_number = self._clean_phone_number(phone_number_raw)

        logger.info(f"[{self.employee_id}] SMS summary requested to {phone_number or 'NO NUMBER'} (raw: {phone_number_raw}) from {from_number or 'NO FROM NUMBER'}")

        if not phone_number or len(phone_number) < 10:
            return SwaigFunctionResult(
                "I need a valid phone number to send the summary. Could you please provide your full phone number including area code?"
            )

        if not from_number:
            logger.warning(f"[{self.employee_id}] SMS skipped — no sms_from_number configured")
            return SwaigFunctionResult(
                "I'm sorry, text messaging is not set up for this agent right now. I've noted the summary for our team."
            )

        # Build SMS body — keep concise to avoid over_data_limit
        agent_name = self.employee_config.get("name", "Agent")
        # Truncate message to stay within SMS limits
        max_message_len = 300
        if len(message) > max_message_len:
            message = message[:max_message_len] + "..."
        parts = [f"[SignalWire] {agent_name} Call Summary:"]
        if caller_info:
            parts.append(f"Caller: {caller_info}")
        parts.append(message)
        parts.append("REPLY STOP TO STOP")
        body = "\n".join(parts)

        try:
            result = SwaigFunctionResult(f"I've sent a text summary to {phone_number_raw}.")
            result.send_sms(phone_number, from_number, body)
            return result
        except Exception as e:
            logger.error(f"[{self.employee_id}] SMS send failed: {e}")
            return SwaigFunctionResult(
                "I'm sorry, I wasn't able to send the text message right now. I've noted the summary for our team instead."
            )

    @AgentBase.tool(
        name="schedule_callback",
        description="Schedule a PHONE CALLBACK for later. Collects name, number, preferred time, and reason. This is NOT for sending text messages — use send_summary_sms for that.",
        parameters={
            "type": "object",
            "properties": {
                "caller_name": {
                    "type": "string",
                    "description": "The caller's name"
                },
                "callback_number": {
                    "type": "string",
                    "description": "Phone number to call back"
                },
                "preferred_time": {
                    "type": "string",
                    "description": "When the caller would like to be called back"
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for the callback"
                }
            },
            "required": ["caller_name", "callback_number", "preferred_time"]
        }
    )
    def schedule_callback(self, args, raw_data):
        """Collect callback request details and store them"""
        caller_name = args.get("caller_name", "")
        callback_number = args.get("callback_number", "")
        preferred_time = args.get("preferred_time", "")
        reason = args.get("reason", "")

        logger.info(f"[{self.employee_id}] Callback scheduled for {caller_name} at {preferred_time}")

        result = SwaigFunctionResult(
            f"I've scheduled a callback for {caller_name} at {preferred_time}. "
            "Someone from our team will reach out to you then."
        )
        result.update_global_data({
            "callback": {
                "name": caller_name,
                "number": callback_number,
                "time": preferred_time,
                "reason": reason[:100]
            }
        })
        return result

    @AgentBase.tool(
        name="check_business_hours",
        description="Check if the business is currently open and provide hours information",
        parameters={
            "type": "object",
            "properties": {}
        }
    )
    def check_business_hours(self, args, raw_data):
        """Return business hours — uses config or defaults"""
        now = datetime.now()
        hour = now.hour
        weekday = now.weekday()  # 0=Monday, 6=Sunday

        start = self.employee_config.get("business_hours_start", 9)
        end = self.employee_config.get("business_hours_end", 18)
        days = self.employee_config.get("business_days", [0, 1, 2, 3, 4])

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        open_days = [day_names[d] for d in sorted(days)]
        hours_str = f"{start % 12 or 12} {'AM' if start < 12 else 'PM'} to {end % 12 or 12} {'AM' if end < 12 else 'PM'}"

        if weekday in days and start <= hour < end:
            return SwaigFunctionResult(
                f"We are currently open. Our business hours are {open_days[0]} through {open_days[-1]}, {hours_str}."
            )
        else:
            return SwaigFunctionResult(
                f"We are currently closed. Our business hours are {open_days[0]} through {open_days[-1]}, {hours_str}. "
                "I can take a message or schedule a callback for when we reopen."
            )

    @AgentBase.tool(
        name="collect_customer_info",
        description="Collect structured customer information during the call. Gather details conversationally — name, email, phone, company, and any notes. Call this once you have collected the relevant details.",
        parameters={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The customer's full name"
                },
                "email": {
                    "type": "string",
                    "description": "The customer's email address"
                },
                "phone": {
                    "type": "string",
                    "description": "The customer's phone number"
                },
                "company": {
                    "type": "string",
                    "description": "The customer's company or organization"
                },
                "notes": {
                    "type": "string",
                    "description": "Any additional notes or context from the conversation"
                }
            }
        }
    )
    def collect_customer_info(self, args, raw_data):
        """Collect and store structured customer information"""
        name = args.get("name", "")
        email = args.get("email", "")
        phone = args.get("phone", "")
        company = args.get("company", "")
        notes = args.get("notes", "")

        collected_fields = []
        if name: collected_fields.append(f"name ({name})")
        if email: collected_fields.append(f"email ({email})")
        if phone: collected_fields.append(f"phone ({phone})")
        if company: collected_fields.append(f"company ({company})")

        logger.info(f"[{self.employee_id}] Customer info collected: {', '.join(collected_fields) or 'no fields'}")

        result = SwaigFunctionResult(
            f"Got it, I've recorded {'your' if name else 'the'} information. Is there anything else I can help with?"
        )
        result.update_global_data({
            "customer_info": {
                "name": name,
                "email": email,
                "phone": phone,
                "company": company,
                "notes": notes[:500]
            }
        })
        return result

    @AgentBase.tool(
        name="send_email",
        description="Send a follow-up email to the caller. Collects their email address and sends a message with call details, confirmations, or any relevant information.",
        parameters={
            "type": "object",
            "properties": {
                "to_email": {
                    "type": "string",
                    "description": "The recipient's email address"
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line"
                },
                "body": {
                    "type": "string",
                    "description": "Email body content — include call summary, action items, or relevant details"
                }
            },
            "required": ["to_email", "subject", "body"]
        }
    )
    def send_email(self, args, raw_data):
        """Send an email via SendGrid"""
        to_email = args.get("to_email", "")
        subject = args.get("subject", "")
        body = args.get("body", "")

        sendgrid_api_key = self.employee_config.get("sendgrid_api_key", "") or os.getenv("SENDGRID_API_KEY", "")
        from_email = self.employee_config.get("email_from_address", "")
        from_name = self.employee_config.get("email_from_name", "") or self.employee_config.get("name", "Agent")

        logger.info(f"[{self.employee_id}] Email requested to {to_email} from {from_email or 'NOT CONFIGURED'}")

        if not to_email or "@" not in to_email:
            return SwaigFunctionResult(
                "I need a valid email address to send to. Could you please provide your email?"
            )

        if not sendgrid_api_key or not from_email:
            logger.warning(f"[{self.employee_id}] Email skipped — SendGrid not configured")
            result = SwaigFunctionResult(
                "Email isn't set up for this agent yet. Let me take a note of your request instead."
            )
            result.update_global_data({
                "email_requested": {
                    "to": to_email,
                    "subject": subject,
                    "body": body[:500],
                    "status": "not_configured"
                }
            })
            return result

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=(from_email, from_name),
                to_emails=to_email,
                subject=subject or f"Follow-up from {from_name}",
                plain_text_content=body
            )

            sg = SendGridAPIClient(sendgrid_api_key)
            response = sg.send(message)

            logger.info(f"[{self.employee_id}] Email sent to {to_email}, status: {response.status_code}")

            result = SwaigFunctionResult(f"I've sent an email to {to_email}.")
            result.update_global_data({
                "email_sent": {
                    "to": to_email,
                    "subject": subject,
                    "status": "sent",
                    "status_code": response.status_code
                }
            })
            return result

        except Exception as e:
            logger.error(f"[{self.employee_id}] Email send failed: {e}")
            result = SwaigFunctionResult(
                "I'm sorry, I wasn't able to send the email right now. I've noted your request for our team."
            )
            result.update_global_data({
                "email_requested": {
                    "to": to_email,
                    "subject": subject,
                    "body": body[:500],
                    "status": "failed",
                    "error": str(e)[:200]
                }
            })
            return result

    @AgentBase.tool(
        name="end_call",
        description="End the call politely when the conversation is complete and the caller is ready to hang up",
        parameters={
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Reason for ending the call"
                }
            }
        }
    )
    def end_call(self, args, raw_data):
        """Politely end the call"""
        reason = args.get("reason", "Conversation complete")
        logger.info(f"[{self.employee_id}] Call ended: {reason}")

        result = SwaigFunctionResult(
            "Thank you for calling! Have a wonderful day. Goodbye!",
            post_process=True
        )
        result.hangup()
        return result

    def on_swml_request(self, request_data=None, callback_path=None, request=None):
        """Override to dynamically set video URLs and enable live transcription"""
        # Get the host from the request object if available
        host = None

        if request:
            host = request.headers.get('x-forwarded-host') or request.headers.get('host')
            protocol = request.headers.get('x-forwarded-proto', 'https')

            if host and ('localhost' in host or '127.0.0.1' in host):
                protocol = 'http'

        # Set video URLs from employee config (or fall back to defaults)
        base_url = (f"{protocol}://{host}" if host else APP_DOMAIN) or ""
        idle_url = self.employee_config.get("video_idle_url", "")
        talking_url = self.employee_config.get("video_talking_url", "")

        # Use config URLs if set, otherwise fall back to default paths
        if not idle_url and base_url:
            idle_url = f"{base_url}/videos/sally_idle.mp4"
        if not talking_url and base_url:
            talking_url = f"{base_url}/videos/sally_talking.mp4"

        if idle_url:
            self.set_param("video_idle_file", idle_url)
        if talking_url:
            self.set_param("video_talking_file", talking_url)

        if idle_url or talking_url:
            logger.info(f"[{self.employee_id}] Video URLs: idle={idle_url}, talking={talking_url}")
        else:
            logger.warning(f"[{self.employee_id}] No video URLs available")

        # Set post_prompt_url — prefer APP_DOMAIN (points to frontend where handler lives)
        post_prompt_domain = APP_DOMAIN or (f"{protocol}://{host}" if host else None)
        if post_prompt_domain:
            post_prompt_path = f"{post_prompt_domain}/api/post-prompt/{self.employee_id}"
            self.set_post_prompt_url(post_prompt_path)
            logger.info(f"[{self.employee_id}] Set post_prompt_url to: {post_prompt_path}")
        else:
            logger.warning(f"[{self.employee_id}] Cannot set post_prompt_url — no domain available")

        # Enable live transcription
        self.add_verb("live_transcribe", {
            "action": "start",
            "lang": self.employee_config.get('language', 'en-US').split('-')[0],
            "live_events": True,
            "direction": ["remote-caller", "local-caller"]
        })

        return super().on_swml_request(request_data, callback_path, request)


def _validate_datasphere_document(space_name, project_id, token, document_id, timeout=5.0):
    """Ping DataSphere with a tiny query to verify a document is reachable and authorized.

    Returns (ok, status) where status is one of: 'ok', 'auth_failed', 'not_found',
    'timeout', 'http_<code>', 'missing_params', 'error:<msg>'.
    """
    import base64
    import urllib.request
    import urllib.error
    import socket

    if not (space_name and project_id and token and document_id):
        return False, "missing_params"
    try:
        url = f"https://{space_name}.signalwire.com/api/datasphere/documents/search"
        auth = base64.b64encode(f"{project_id}:{token}".encode()).decode()
        body = json.dumps({"document_id": document_id, "query_string": "ping", "count": 1}).encode()
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Basic {auth}",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (resp.status == 200, "ok" if resp.status == 200 else f"http_{resp.status}")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return False, "auth_failed"
        if e.code == 404:
            return False, "not_found"
        return False, f"http_{e.code}"
    except socket.timeout:
        return False, "timeout"
    except Exception as e:
        return False, f"error:{str(e)[:80]}"


def _validate_employee_documents(employee_config):
    """Run validation on each DataSphere doc in the employee config, in place.

    Adds `validation_status` to every dict-shaped document. Non-DataSphere docs get
    'skipped'. Never raises — validation failures are surfaced as a status string.
    """
    documents = employee_config.get('documents') or []
    if not documents:
        return
    space_name = os.getenv('SIGNALWIRE_SPACE', '') or employee_config.get('space_name', '')
    project_id = os.getenv('SIGNALWIRE_PROJECT_ID', '') or employee_config.get('project_id', '')
    token = os.getenv('SIGNALWIRE_TOKEN', '') or employee_config.get('token', '')

    for doc in documents:
        if not isinstance(doc, dict):
            continue
        backend = (doc.get('backend') or 'datasphere').lower()
        if backend != 'datasphere':
            doc['validation_status'] = 'skipped'
            continue
        doc_id = doc.get('document_id')
        if not doc_id:
            doc['validation_status'] = 'missing_document_id'
            continue
        ok, status = _validate_datasphere_document(space_name, project_id, token, doc_id)
        doc['validation_status'] = status
        if not ok:
            logger.warning(
                f"[{employee_config.get('id')}] DataSphere validation failed for {doc_id}: {status}"
            )


# Create FastAPI app
app = FastAPI(
    title="Virtual Employees Backend",
    description="Multi-agent AI system with dynamic SWML endpoints"
)

# CORS — set CORS_ORIGINS to a comma-separated allowlist in production.
# Default is open for local dev; allow_credentials is False so a "*" origin is spec-valid.
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _remount_employee_router(employee_id: str, agent: VirtualEmployeeAgent):
    """Remove old routes for an employee and mount the new agent's router."""
    prefix = f"/swml/{employee_id}"
    # Remove existing routes with this prefix
    app.routes[:] = [
        r for r in app.routes
        if not (hasattr(r, 'path') and r.path.startswith(prefix))
    ]
    # Mount new router (strip BasicAuth dependencies)
    router = agent.as_router()
    if hasattr(router, 'dependencies'):
        router.dependencies = [dep for dep in router.dependencies if 'BasicAuth' not in str(type(dep))]
    app.include_router(router, prefix=prefix)
    logger.info(f"   Mounted router at: {prefix}")


# Employee Management API Endpoints

@app.post("/api/create-employee")
async def create_employee(request: Request):
    """Create a new virtual employee"""
    try:
        data = await request.json()

        # Use provided ID (for re-creation after restart) or generate a new one
        employee_id = data.get("id") or str(uuid.uuid4())[:8]

        # Create employee config
        employee_config = {
            "id": employee_id,
            "name": data.get("name", "Virtual Employee"),
            "role": data.get("role", "Assistant"),
            "greeting": data.get("greeting", "Hello, how can I help you today?"),
            "prompt": data.get("prompt", ""),
            "voice": data.get("voice", "openai.nova"),
            "language": data.get("language", "en-US"),
            "temperature": data.get("temperature", 0.7),
            "speech_hints": data.get("speech_hints", []),
            "enabled_functions": data.get("enabled_functions", ["transfer_to_human", "send_summary_sms", "end_call"]),
            "transfer_number": data.get("transfer_number", ""),
            "transfer_from": data.get("transfer_from", ""),
            "sms_from_number": data.get("sms_from_number", ""),
            "video_idle_url": data.get("video_idle_url", ""),
            "video_talking_url": data.get("video_talking_url", ""),
            "business_hours_start": data.get("business_hours_start", 9),
            "business_hours_end": data.get("business_hours_end", 18),
            "business_days": data.get("business_days", [0, 1, 2, 3, 4]),
            "documents": data.get("documents", []),
            "kb_no_results_message": data.get("kb_no_results_message", ""),
            "sendgrid_api_key": data.get("sendgrid_api_key", ""),
            "email_from_address": data.get("email_from_address", ""),
            "email_from_name": data.get("email_from_name", ""),
            "space_name": data.get("space_name", ""),
            "project_id": data.get("project_id", ""),
            "token": data.get("token", ""),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        }

        # Store employee
        employees[employee_id] = employee_config

        # Validate attached DataSphere docs so the UI can flag bad IDs / auth issues
        _validate_employee_documents(employee_config)

        # Create agent instance and mount router
        agent = VirtualEmployeeAgent(employee_config)
        agent_instances[employee_id] = agent
        _remount_employee_router(employee_id, agent)

        logger.info(f"✅ Created virtual employee: {employee_config['name']} ({employee_id})")
        logger.info(f"   Route: /swml/{employee_id}")

        return {
            "success": True,
            "employee": employee_config,
            "swml_route": f"/swml/{employee_id}",
            "message": "Virtual employee created successfully"
        }

    except Exception as e:
        logger.error(f"Error creating employee: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/list-employees")
async def list_employees():
    """List all virtual employees"""
    return {
        "success": True,
        "employees": list(employees.values()),
        "count": len(employees)
    }


@app.get("/api/employee/{employee_id}")
async def get_employee(employee_id: str = Path(...)):
    """Get a specific employee's configuration"""
    if employee_id not in employees:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {
        "success": True,
        "employee": employees[employee_id]
    }


@app.patch("/api/employee/{employee_id}")
async def update_employee(employee_id: str, request: Request):
    """Update an employee's configuration"""
    if employee_id not in employees:
        raise HTTPException(status_code=404, detail="Employee not found")

    try:
        data = await request.json()

        # Update employee config
        employee_config = employees[employee_id]
        employee_config.update({
            "name": data.get("name", employee_config["name"]),
            "role": data.get("role", employee_config["role"]),
            "greeting": data.get("greeting", employee_config["greeting"]),
            "prompt": data.get("prompt", employee_config["prompt"]),
            "voice": data.get("voice", employee_config["voice"]),
            "language": data.get("language", employee_config["language"]),
            "temperature": data.get("temperature", employee_config["temperature"]),
            "speech_hints": data.get("speech_hints", employee_config["speech_hints"]),
            "enabled_functions": data.get("enabled_functions", employee_config["enabled_functions"]),
            "transfer_number": data.get("transfer_number", employee_config.get("transfer_number", "")),
            "transfer_from": data.get("transfer_from", employee_config.get("transfer_from", "")),
            "sms_from_number": data.get("sms_from_number", employee_config.get("sms_from_number", "")),
            "video_idle_url": data.get("video_idle_url", employee_config.get("video_idle_url", "")),
            "video_talking_url": data.get("video_talking_url", employee_config.get("video_talking_url", "")),
            "business_hours_start": data.get("business_hours_start", employee_config.get("business_hours_start", 9)),
            "business_hours_end": data.get("business_hours_end", employee_config.get("business_hours_end", 18)),
            "business_days": data.get("business_days", employee_config.get("business_days", [0, 1, 2, 3, 4])),
            "documents": data.get("documents", employee_config.get("documents", [])),
            "kb_no_results_message": data.get("kb_no_results_message", employee_config.get("kb_no_results_message", "")),
            "sendgrid_api_key": data.get("sendgrid_api_key", employee_config.get("sendgrid_api_key", "")),
            "email_from_address": data.get("email_from_address", employee_config.get("email_from_address", "")),
            "email_from_name": data.get("email_from_name", employee_config.get("email_from_name", "")),
            "space_name": data.get("space_name", employee_config.get("space_name", "")),
            "project_id": data.get("project_id", employee_config.get("project_id", "")),
            "token": data.get("token", employee_config.get("token", "")),
            "updated_at": datetime.now().isoformat()
        })

        # Re-validate DataSphere docs after config changes
        _validate_employee_documents(employee_config)

        # Recreate agent instance and remount router
        agent = VirtualEmployeeAgent(employee_config)
        agent_instances[employee_id] = agent
        _remount_employee_router(employee_id, agent)

        logger.info(f"✅ Updated virtual employee: {employee_config['name']} ({employee_id})")

        return {
            "success": True,
            "employee": employee_config,
            "message": "Employee updated successfully"
        }

    except Exception as e:
        logger.error(f"Error updating employee: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/employee/{employee_id}")
async def delete_employee(employee_id: str = Path(...)):
    """Delete a virtual employee"""
    if employee_id not in employees:
        raise HTTPException(status_code=404, detail="Employee not found")

    try:
        # Remove employee
        employee_name = employees[employee_id]["name"]
        del employees[employee_id]

        # Remove agent instance
        if employee_id in agent_instances:
            del agent_instances[employee_id]

        # Remove routes for this employee
        prefix = f"/swml/{employee_id}"
        app.routes[:] = [
            r for r in app.routes
            if not (hasattr(r, 'path') and r.path.startswith(prefix))
        ]

        logger.info(f"🗑️  Deleted virtual employee: {employee_name} ({employee_id})")

        return {
            "success": True,
            "message": "Employee deleted successfully"
        }

    except Exception as e:
        logger.error(f"Error deleting employee: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Legacy endpoints for backward compatibility
@app.post("/api/update-config")
async def update_config_legacy(request: Request):
    """Legacy endpoint - creates/updates a default employee"""
    try:
        data = await request.json()

        # Check if default employee exists
        default_id = "default"
        if default_id not in employees:
            # Create default employee
            employee_config = {
                "id": default_id,
                "name": "Sally Sales",
                "role": "Sales Representative",
                "greeting": "Hello! Welcome to Sally Sales.",
                "prompt": data.get("prompt", ""),
                "voice": "openai.nova",
                "language": "en-US",
                "temperature": 0.7,
                "speech_hints": [],
                "enabled_functions": ["transfer_to_human", "send_summary_sms", "end_call"],
                "transfer_number": "",
                "transfer_from": "",
                "sms_from_number": "",
                "video_idle_url": "",
                "video_talking_url": "",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "status": "active"
            }
            employees[default_id] = employee_config

            # Create agent and mount router
            agent = VirtualEmployeeAgent(employee_config)
            agent_instances[default_id] = agent
            _remount_employee_router(default_id, agent)
        else:
            # Update existing
            employees[default_id]["prompt"] = data.get("prompt", employees[default_id]["prompt"])
            employees[default_id]["updated_at"] = datetime.now().isoformat()

            # Recreate agent and remount router
            agent = VirtualEmployeeAgent(employees[default_id])
            agent_instances[default_id] = agent
            _remount_employee_router(default_id, agent)

        return {
            "success": True,
            "message": "Configuration updated",
            "config": employees[default_id]
        }

    except Exception as e:
        logger.error(f"Error updating config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Legacy endpoint - returns default employee config"""
    default_id = "default"
    config = employees.get(default_id, {
        "prompt": "Welcome to Sally Sales",
        "created_at": datetime.now().isoformat()
    })

    default_swml_path = f"/swml/{default_id}"
    swml_url = f"{APP_DOMAIN}{default_swml_path}" if APP_DOMAIN else default_swml_path

    return {
        "success": True,
        "config": config,
        "credentials": agent_credentials,
        "swml_url": swml_url
    }


@app.get("/api/agent-info")
async def get_agent_info():
    """Get agent system information"""
    return {
        "status": "healthy",
        "total_employees": len(employees),
        "active_employees": len([e for e in employees.values() if e.get("status") == "active"]),
        "credentials": agent_credentials,
        "timestamp": datetime.now().isoformat()
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "employees": len(employees),
        "timestamp": datetime.now().isoformat()
    }


# Main entry point
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🚀 Starting Virtual Employees Backend")
    logger.info("=" * 60)
    logger.info(f"📋 Multi-Agent System Initialized")
    logger.info(f"🔐 Credentials: {agent_credentials['username']}:***")
    logger.info(f"🌐 App Domain: {agent_credentials['app_domain']}")
    logger.info(f"🎯 Employees will be available at: /swml/{{employee_id}}")
    logger.info("=" * 60)

    # Auto-detect ngrok URL if APP_DOMAIN not set
    if not APP_DOMAIN:
        detected = _detect_ngrok_url()
        if detected:
            APP_DOMAIN = detected
            agent_credentials["app_domain"] = detected
            logger.info(f"🔍 Auto-detected ngrok URL: {detected}")
        else:
            logger.warning("APP_DOMAIN not set and ngrok not detected")

    # Write credentials to file for web app
    try:
        credentials_file = os.path.join(os.path.dirname(__file__), '..', 'web', 'agent-credentials.json')
        swml_path = "/swml/default"
        with open(credentials_file, 'w') as f:
            json.dump({
                "username": agent_credentials["username"],
                "password": agent_credentials["password"],
                "app_domain": agent_credentials["app_domain"],
                "swml_url": f"{agent_credentials['app_domain']}{swml_path}" if agent_credentials['app_domain'] else swml_path,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        logger.info(f"✅ Wrote credentials to: {credentials_file}")
    except Exception as e:
        logger.warning(f"Could not write credentials file: {e}")

    # Start server
    uvicorn.run(app, host="0.0.0.0", port=8000)
