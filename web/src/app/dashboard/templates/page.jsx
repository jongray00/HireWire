"use client";

import { useNavigate } from "react-router";
import {
  FileText,
  Phone,
  ShoppingCart,
  Calendar,
  HeadphonesIcon,
  Briefcase,
  Check,
  Sparkles,
  Mic,
  Sliders,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Complete template configurations — every field the employee form needs
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    id: "sales-representative",
    name: "Sales Representative",
    description:
      "A professional sales agent trained to qualify leads, answer product questions, and schedule demos with your sales team.",
    icon: Briefcase,
    color: "blue",
    features: [
      "Lead qualification",
      "Product knowledge",
      "Demo scheduling",
      "Objection handling",
    ],
    defaultData: {
      name: "Sales Agent",
      role: "Sales Representative",
      greeting:
        "Hi there! Thanks for reaching out. I'm here to help you find the right solution for your business. What brings you in today?",
      prompt: `## Role
You are a professional sales representative. You are warm, confident, and consultative — never pushy.

## Goal
Qualify inbound leads by understanding their needs, budget, and timeline. Guide them toward the right solution and offer to schedule a follow-up or connect them with a specialist.

## Instructions
1. Greet the caller warmly and introduce yourself by name
2. Ask one qualifying question at a time — do not stack multiple questions
3. Listen carefully and reflect back what you hear before moving on
4. Match the caller's needs to your products or services
5. If the caller is a good fit, offer to schedule a callback or demo
6. If they need support instead of sales, offer to transfer them

## Qualifying Questions
- What challenges are you currently facing?
- What solutions have you tried so far?
- What is your timeline for making a decision?
- Who else is involved in the decision-making process?

## Constraints
- Keep responses to 2-3 sentences maximum
- Never fabricate product details — say "let me connect you with a specialist" if unsure
- Always use the caller's name once you learn it
- End every interaction with a clear next step`,
      voice: "elevenlabs.rachel",
      language: "en-US",
      temperature: 0.6,
      speech_hints: [
        "pricing",
        "demo",
        "trial",
        "enterprise",
        "features",
        "competitor",
        "budget",
        "timeline",
      ],
      enabled_functions: ["collect_customer_info", "search_knowledge", "send_email", "send_summary_sms", "schedule_callback", "transfer_to_human", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
  {
    id: "customer-support",
    name: "Customer Support Agent",
    description:
      "24/7 customer support agent that handles inquiries, troubleshoots issues, and escalates complex cases to human specialists.",
    icon: HeadphonesIcon,
    color: "green",
    features: [
      "Issue troubleshooting",
      "Ticket escalation",
      "Account lookup",
      "Resolution tracking",
    ],
    defaultData: {
      name: "Support Agent",
      role: "Customer Support Agent",
      greeting:
        "Thank you for calling support. I'm here to help resolve any issues you're experiencing. How can I assist you today?",
      prompt: `## Role
You are a patient and knowledgeable customer support agent. You are empathetic, calm, and solution-oriented.

## Goal
Resolve the caller's issue on the first contact whenever possible. If you cannot resolve it, collect their information and escalate appropriately.

## Instructions
1. Greet the caller and ask how you can help
2. Listen to their issue fully before responding
3. Ask one clarifying question at a time to diagnose the problem
4. Start with the most common solutions first
5. Walk through each step and confirm before moving to the next
6. If you cannot resolve the issue, take a message or offer to transfer

## Constraints
- Never blame the caller for the issue
- Acknowledge frustration before offering solutions: "I understand that's frustrating"
- Use simple, non-technical language
- Keep responses clear and actionable
- Always confirm resolution: "Is there anything else I can help with?"
- If you are unsure of the answer, say so honestly rather than guessing`,
      voice: "deepgram.aura-asteria-en",
      language: "en-US",
      temperature: 0.3,
      speech_hints: [
        "account",
        "billing",
        "refund",
        "password",
        "error",
        "broken",
        "not working",
        "help",
      ],
      enabled_functions: ["search_knowledge", "collect_customer_info", "send_email", "transfer_to_human", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
  {
    id: "appointment-scheduler",
    name: "Appointment Scheduler",
    description:
      "Intelligent scheduling assistant that collects information, finds available times, and books appointments efficiently.",
    icon: Calendar,
    color: "purple",
    features: [
      "Information gathering",
      "Availability checking",
      "Appointment booking",
      "Confirmation & reminders",
    ],
    defaultData: {
      name: "Scheduling Assistant",
      role: "Appointment Scheduler",
      greeting:
        "Hello! I can help you schedule an appointment. Let me gather a few details to find the best time for you.",
      prompt: `## Role
You are an efficient and friendly appointment scheduling assistant. You are organized, precise, and respectful of people's time.

## Goal
Collect the caller's information, understand what appointment they need, gather their preferred times, and confirm all details before scheduling.

## Instructions
1. Greet the caller and ask what type of appointment they need
2. Collect their full name
3. Collect a callback phone number or email
4. Ask for their preferred date and time of day
5. If their first choice is unavailable, offer alternatives
6. Read back all details and confirm before booking

## Information to Collect
- Full name
- Phone number or email for confirmation
- Type of appointment or service needed
- Preferred date and time
- Any special requirements or notes

## Constraints
- Ask one question at a time — never bundle multiple questions
- Always repeat back information to confirm accuracy
- Keep responses brief and focused on the next question
- End with a clear summary of the scheduled appointment`,
      voice: "openai.nova",
      language: "en-US",
      temperature: 0.4,
      speech_hints: [
        "appointment",
        "schedule",
        "available",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "morning",
        "afternoon",
        "reschedule",
        "cancel",
      ],
      enabled_functions: ["schedule_callback", "collect_customer_info", "check_business_hours", "send_summary_sms", "transfer_to_human", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
  {
    id: "order-taker",
    name: "Order Taking Assistant",
    description:
      "Accurate order-taking agent for restaurants or retail that handles customizations, confirms orders, and processes requests.",
    icon: ShoppingCart,
    color: "orange",
    features: [
      "Order processing",
      "Customization handling",
      "Order confirmation",
      "Upsell suggestions",
    ],
    defaultData: {
      name: "Order Assistant",
      role: "Order Taking Specialist",
      greeting:
        "Welcome! I'll be taking your order today. What can I get started for you?",
      prompt: `## Role
You are a friendly and accurate order-taking assistant. You are conversational, attentive, and precise — like a great server at a restaurant.

## Goal
Take the caller's order accurately, handle customizations, confirm the complete order, and provide a clear summary.

## Instructions
1. Greet the caller and ask what they would like to order
2. Listen to each item and confirm quantities and customizations
3. Suggest one complementary item naturally — do not upsell aggressively
4. Keep a running note of the order
5. When they are finished, read back the complete order for confirmation
6. Provide an estimated total or next steps

## Constraints
- Use short confirmations as you go: "Got it!", "Great choice!"
- If an item is unclear, ask for clarification immediately
- Never assume customizations — always confirm
- Read the complete order clearly at the end before finishing
- Keep responses brief during ordering, detailed during confirmation`,
      voice: "elevenlabs.thomas",
      language: "en-US",
      temperature: 0.3,
      speech_hints: [
        "order",
        "large",
        "medium",
        "small",
        "extra",
        "no",
        "add",
        "remove",
        "side",
        "drink",
        "total",
        "that's all",
      ],
      enabled_functions: ["collect_customer_info", "send_summary_sms", "send_email", "transfer_to_human", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
  {
    id: "virtual-receptionist",
    name: "Virtual Receptionist",
    description:
      "Professional receptionist that greets callers, identifies their needs, and routes them to the right department or person.",
    icon: Phone,
    color: "pink",
    features: [
      "Call routing",
      "Department directory",
      "Message taking",
      "General information",
    ],
    defaultData: {
      name: "Receptionist",
      role: "Virtual Receptionist",
      greeting:
        "Good day, thank you for calling. How may I direct your call today?",
      prompt: `## Role
You are a professional virtual receptionist. You are courteous, efficient, and the first point of contact for all callers.

## Goal
Greet every caller professionally, quickly identify the purpose of their call, and route them to the correct department or take a message.

## Available Departments
- Sales: Product inquiries, pricing, and purchases
- Support: Technical issues, account problems, and troubleshooting
- Scheduling: Appointments, meetings, and calendar requests
- General: All other inquiries

## Instructions
1. Greet every caller professionally: "Thank you for calling, how may I help you?"
2. Listen to their request and identify the appropriate department
3. If unsure where to route, ask one clarifying question
4. Confirm before transferring: "I'll connect you with our [department] team now"
5. If the requested person is unavailable, offer to take a message
6. For general questions about the business, answer directly if you can

## Constraints
- Use formal but friendly language at all times
- Keep responses concise — callers want to reach the right person quickly
- Never leave a caller without a clear next step
- If you cannot help, always offer to take a message or schedule a callback`,
      voice: "openai.shimmer",
      language: "en-US",
      temperature: 0.4,
      speech_hints: [
        "sales",
        "support",
        "billing",
        "manager",
        "representative",
        "department",
        "extension",
        "transfer",
        "message",
      ],
      enabled_functions: ["search_knowledge", "collect_customer_info", "schedule_callback", "check_business_hours", "transfer_to_human", "send_summary_sms", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
  {
    id: "survey-collector",
    name: "Survey & Feedback Collector",
    description:
      "Automated survey agent that conducts satisfaction surveys, collects structured feedback, and identifies improvement areas.",
    icon: FileText,
    color: "cyan",
    features: [
      "Structured surveys",
      "Rating collection",
      "Open-ended feedback",
      "Follow-up scheduling",
    ],
    defaultData: {
      name: "Survey Agent",
      role: "Feedback Collector",
      greeting:
        "Hi! Thank you for taking the time to share your feedback with us. This will only take a few minutes. Shall we get started?",
      prompt: `## Role
You are a friendly and neutral survey agent. You are warm, appreciative, and careful not to influence responses.

## Goal
Conduct a brief satisfaction survey, collect honest ratings and open-ended feedback, and thank the caller for their time.

## Survey Flow
1. Ask for an overall satisfaction rating on a scale of 1 to 5
2. Ask what they liked most about their experience
3. Ask what could be improved
4. Ask if they would recommend us to others on a scale of 1 to 10
5. Ask if there is anything else they would like to share
6. Thank them and offer to connect them with someone if they mentioned an unresolved issue

## Constraints
- Be warm and appreciative but stay neutral — do not influence answers
- Accept all feedback without being defensive
- Use encouraging language: "That's really helpful feedback, thank you"
- Keep transitions smooth between questions
- If they mention a specific issue, acknowledge it and offer follow-up after the survey
- Respect their time — keep the survey under 5 minutes`,
      voice: "openai.alloy",
      language: "en-US",
      temperature: 0.3,
      speech_hints: [
        "rating",
        "score",
        "satisfied",
        "dissatisfied",
        "recommend",
        "improve",
        "feedback",
        "experience",
        "one",
        "two",
        "three",
        "four",
        "five",
      ],
      enabled_functions: ["collect_customer_info", "send_summary_sms", "end_call"],
      transfer_number: "",
      sms_from_number: "",
      video_idle_url: "",
      video_talking_url: "",
    },
  },
];

// ---------------------------------------------------------------------------
// Voice label lookup
// ---------------------------------------------------------------------------

const VOICE_LABELS = {
  "openai.nova": "Nova (OpenAI)",
  "openai.alloy": "Alloy (OpenAI)",
  "openai.echo": "Echo (OpenAI)",
  "openai.fable": "Fable (OpenAI)",
  "openai.onyx": "Onyx (OpenAI)",
  "openai.shimmer": "Shimmer (OpenAI)",
  "elevenlabs.rachel": "Rachel (ElevenLabs)",
  "elevenlabs.thomas": "Thomas (ElevenLabs)",
  "elevenlabs.charlie": "Charlie (ElevenLabs)",
  "elevenlabs.emily": "Emily (ElevenLabs)",
  "elevenlabs.alice": "Alice (ElevenLabs)",
  "elevenlabs.daniel": "Daniel (ElevenLabs)",
  "elevenlabs.brian": "Brian (ElevenLabs)",
  "elevenlabs.lily": "Lily (ElevenLabs)",
  "deepgram.aura-asteria-en": "Asteria (Deepgram)",
  "deepgram.aura-luna-en": "Luna (Deepgram)",
  "deepgram.aura-orion-en": "Orion (Deepgram)",
  "deepgram.aura-athena-en": "Athena (Deepgram)",
  "gcloud.en-US-Neural2-A": "Neural2-A (Google)",
  "rime.luna:arcana": "Luna (Rime)",
  "amazon.Joanna-Neural": "Joanna (Amazon)",
  "azure.en-US-AvaNeural": "Ava (Azure)",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const navigate = useNavigate();

  const handleUseTemplate = (template) => {
    navigate("/dashboard/employees?new=true", {
      state: { template: template.defaultData },
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <Sparkles size={32} />
          <h1 className="text-3xl font-bold">AI Agent Templates</h1>
        </div>
        <p className="text-purple-100 max-w-2xl">
          Get started quickly with pre-configured AI voice agents. Each template
          includes a tailored prompt, voice selection, and function routing based
          on SignalWire SDK best practices.
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => handleUseTemplate(template)}
          />
        ))}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Need a custom solution?
        </h3>
        <p className="text-blue-800 dark:text-blue-200 mb-4">
          Can't find the right template? Create a custom AI agent from scratch
          tailored to your specific requirements.
        </p>
        <button
          onClick={() => navigate("/dashboard/employees?new=true")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Create Custom Agent
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

function TemplateCard({ template, onClick }) {
  const Icon = template.icon;
  const data = template.defaultData;

  const colorClasses = {
    blue: "from-blue-600 to-blue-700",
    green: "from-green-600 to-green-700",
    purple: "from-purple-600 to-purple-700",
    orange: "from-orange-600 to-orange-700",
    pink: "from-pink-600 to-pink-700",
    cyan: "from-cyan-600 to-cyan-700",
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
    >
      <div
        className={`bg-gradient-to-r ${colorClasses[template.color]} p-6 flex items-center justify-center`}
      >
        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
          <Icon className="text-white" size={32} />
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {template.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {template.description}
        </p>

        {/* Quick config preview */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
            <Mic size={10} />
            {VOICE_LABELS[data.voice] || data.voice}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
            <Sliders size={10} />
            Temp {data.temperature}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
            <Zap size={10} />
            {data.enabled_functions.length} functions
          </span>
        </div>

        {/* Features */}
        <div className="space-y-2 mb-6">
          {template.features.slice(0, 3).map((feature, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <Check className="text-green-600 dark:text-green-400" size={16} />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Use Template
        </button>
      </div>
    </div>
  );
}

