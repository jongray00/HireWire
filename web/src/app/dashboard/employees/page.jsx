"use client";

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Save,
  Mic,
  Globe,
  Zap,
  Sliders,
  Search,
  X,
  Copy,
  Check,
  Video,
  Phone,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useCallWidget } from "@/app/hooks/useCallWidget";
import PhoneNumberPicker from '@/components/dashboard/PhoneNumberPicker';
import KnowledgeBaseTab from '@/components/dashboard/KnowledgeBaseTab';

// Voice options for SignalWire TTS
// langs: array of base language codes this voice supports. "all" = fully multilingual.
const ALL_LANGS = "all";
const VOICE_OPTIONS = [
  // OpenAI — fully multilingual
  { value: "openai.alloy", label: "Alloy", provider: "OpenAI", langs: ALL_LANGS },
  { value: "openai.echo", label: "Echo", provider: "OpenAI", langs: ALL_LANGS },
  { value: "openai.fable", label: "Fable", provider: "OpenAI", langs: ALL_LANGS },
  { value: "openai.nova", label: "Nova", provider: "OpenAI", langs: ALL_LANGS },
  { value: "openai.onyx", label: "Onyx", provider: "OpenAI", langs: ALL_LANGS },
  { value: "openai.shimmer", label: "Shimmer", provider: "OpenAI", langs: ALL_LANGS },
  // ElevenLabs — fully multilingual
  { value: "elevenlabs.rachel", label: "Rachel", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.drew", label: "Drew", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.clyde", label: "Clyde", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.paul", label: "Paul", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.domi", label: "Domi", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.dave", label: "Dave", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.fin", label: "Fin", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.sarah", label: "Sarah", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.antoni", label: "Antoni", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.thomas", label: "Thomas", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.charlie", label: "Charlie", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.george", label: "George", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.emily", label: "Emily", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.elli", label: "Elli", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.callum", label: "Callum", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.charlotte", label: "Charlotte", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.alice", label: "Alice", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.matilda", label: "Matilda", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.james", label: "James", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.daniel", label: "Daniel", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.lily", label: "Lily", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.brian", label: "Brian", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.adam", label: "Adam", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.bill", label: "Bill", provider: "ElevenLabs", langs: ALL_LANGS },
  { value: "elevenlabs.sam", label: "Sam", provider: "ElevenLabs", langs: ALL_LANGS },
  // Deepgram — English only
  { value: "deepgram.aura-asteria-en", label: "Asteria", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-luna-en", label: "Luna", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-stella-en", label: "Stella", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-athena-en", label: "Athena", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-hera-en", label: "Hera", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-orion-en", label: "Orion", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-arcas-en", label: "Arcas", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-perseus-en", label: "Perseus", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-angus-en", label: "Angus", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-orpheus-en", label: "Orpheus", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-helios-en", label: "Helios", provider: "Deepgram", langs: ["en"] },
  { value: "deepgram.aura-zeus-en", label: "Zeus", provider: "Deepgram", langs: ["en"] },
  // Google Cloud — language encoded in voice ID
  { value: "gcloud.en-US-Neural2-A", label: "Neural2-A (en-US)", provider: "Google", langs: ["en"] },
  { value: "gcloud.en-US-Neural2-C", label: "Neural2-C (en-US)", provider: "Google", langs: ["en"] },
  { value: "gcloud.en-US-Neural2-D", label: "Neural2-D (en-US)", provider: "Google", langs: ["en"] },
  { value: "gcloud.en-US-Neural2-F", label: "Neural2-F (en-US)", provider: "Google", langs: ["en"] },
  { value: "gcloud.en-GB-Wavenet-A", label: "Wavenet-A (en-GB)", provider: "Google", langs: ["en"] },
  { value: "gcloud.en-GB-Wavenet-B", label: "Wavenet-B (en-GB)", provider: "Google", langs: ["en"] },
  { value: "gcloud.es-ES-Neural2-A", label: "Neural2-A (es-ES)", provider: "Google", langs: ["es"] },
  { value: "gcloud.fr-FR-Wavenet-C", label: "Wavenet-C (fr-FR)", provider: "Google", langs: ["fr"] },
  { value: "gcloud.de-DE-Standard-A", label: "Standard-A (de-DE)", provider: "Google", langs: ["de"] },
  { value: "gcloud.ja-JP-Neural2-B", label: "Neural2-B (ja-JP)", provider: "Google", langs: ["ja"] },
  { value: "gcloud.zh-CN-Neural2-A", label: "Neural2-A (zh-CN)", provider: "Google", langs: ["zh"] },
  { value: "gcloud.ko-KR-Neural2-A", label: "Neural2-A (ko-KR)", provider: "Google", langs: ["ko"] },
  { value: "gcloud.pt-BR-Neural2-A", label: "Neural2-A (pt-BR)", provider: "Google", langs: ["pt"] },
  { value: "gcloud.it-IT-Neural2-A", label: "Neural2-A (it-IT)", provider: "Google", langs: ["it"] },
  { value: "gcloud.nl-NL-Wavenet-A", label: "Wavenet-A (nl-NL)", provider: "Google", langs: ["nl"] },
  { value: "gcloud.pl-PL-Wavenet-A", label: "Wavenet-A (pl-PL)", provider: "Google", langs: ["pl"] },
  { value: "gcloud.ru-RU-Wavenet-A", label: "Wavenet-A (ru-RU)", provider: "Google", langs: ["ru"] },
  { value: "gcloud.tr-TR-Wavenet-A", label: "Wavenet-A (tr-TR)", provider: "Google", langs: ["tr"] },
  { value: "gcloud.sv-SE-Wavenet-A", label: "Wavenet-A (sv-SE)", provider: "Google", langs: ["sv"] },
  { value: "gcloud.da-DK-Wavenet-A", label: "Wavenet-A (da-DK)", provider: "Google", langs: ["da"] },
  { value: "gcloud.hi-IN-Wavenet-A", label: "Wavenet-A (hi-IN)", provider: "Google", langs: ["hi"] },
  { value: "gcloud.vi-VN-Wavenet-A", label: "Wavenet-A (vi-VN)", provider: "Google", langs: ["vi"] },
  { value: "gcloud.uk-UA-Wavenet-A", label: "Wavenet-A (uk-UA)", provider: "Google", langs: ["uk"] },
  // Rime — English, Spanish, French, German, Hindi (Arcana only)
  { value: "rime.luna:arcana", label: "Luna (Arcana)", provider: "Rime", langs: ["en", "es", "fr", "de", "hi"] },
  { value: "rime.spore:mist", label: "Spore (Mist)", provider: "Rime", langs: ["en", "es", "fr", "de"] },
  // Amazon Polly — language-specific voices
  { value: "amazon.Joanna-Neural", label: "Joanna (en-US)", provider: "Amazon", langs: ["en"] },
  { value: "amazon.Matthew-Neural", label: "Matthew (en-US)", provider: "Amazon", langs: ["en"] },
  { value: "amazon.Danielle-Neural", label: "Danielle (en-US)", provider: "Amazon", langs: ["en"] },
  { value: "amazon.Ruth-Neural", label: "Ruth (en-US)", provider: "Amazon", langs: ["en"] },
  { value: "amazon.Amy-Neural", label: "Amy (en-GB)", provider: "Amazon", langs: ["en"] },
  { value: "amazon.Lupe-Neural", label: "Lupe (es-US)", provider: "Amazon", langs: ["es"] },
  { value: "amazon.Lucia-Neural", label: "Lucia (es-ES)", provider: "Amazon", langs: ["es"] },
  { value: "amazon.Lea-Neural", label: "Léa (fr-FR)", provider: "Amazon", langs: ["fr"] },
  { value: "amazon.Vicki-Neural", label: "Vicki (de-DE)", provider: "Amazon", langs: ["de"] },
  { value: "amazon.Bianca-Neural", label: "Bianca (it-IT)", provider: "Amazon", langs: ["it"] },
  { value: "amazon.Camila-Neural", label: "Camila (pt-BR)", provider: "Amazon", langs: ["pt"] },
  { value: "amazon.Takumi-Neural", label: "Takumi (ja-JP)", provider: "Amazon", langs: ["ja"] },
  { value: "amazon.Zhiyu-Neural", label: "Zhiyu (zh-CN)", provider: "Amazon", langs: ["zh"] },
  { value: "amazon.Seoyeon-Neural", label: "Seoyeon (ko-KR)", provider: "Amazon", langs: ["ko"] },
  { value: "amazon.Kajal-Neural", label: "Kajal (hi-IN)", provider: "Amazon", langs: ["hi"] },
  // Azure — language encoded in voice name
  { value: "azure.en-US-AvaNeural", label: "Ava (en-US)", provider: "Azure", langs: ["en"] },
  { value: "azure.en-US-AndrewNeural", label: "Andrew (en-US)", provider: "Azure", langs: ["en"] },
  { value: "azure.en-GB-SoniaNeural", label: "Sonia (en-GB)", provider: "Azure", langs: ["en"] },
  { value: "azure.es-ES-ElviraNeural", label: "Elvira (es-ES)", provider: "Azure", langs: ["es"] },
  { value: "azure.fr-FR-DeniseNeural", label: "Denise (fr-FR)", provider: "Azure", langs: ["fr"] },
  { value: "azure.de-DE-KatjaNeural", label: "Katja (de-DE)", provider: "Azure", langs: ["de"] },
  { value: "azure.it-IT-ElsaNeural", label: "Elsa (it-IT)", provider: "Azure", langs: ["it"] },
  { value: "azure.pt-BR-FranciscaNeural", label: "Francisca (pt-BR)", provider: "Azure", langs: ["pt"] },
  { value: "azure.ja-JP-NanamiNeural", label: "Nanami (ja-JP)", provider: "Azure", langs: ["ja"] },
  { value: "azure.zh-CN-XiaoxiaoNeural", label: "Xiaoxiao (zh-CN)", provider: "Azure", langs: ["zh"] },
  { value: "azure.ko-KR-SunHiNeural", label: "SunHi (ko-KR)", provider: "Azure", langs: ["ko"] },
  { value: "azure.hi-IN-SwaraNeural", label: "Swara (hi-IN)", provider: "Azure", langs: ["hi"] },
  { value: "azure.ru-RU-SvetlanaNeural", label: "Svetlana (ru-RU)", provider: "Azure", langs: ["ru"] },
  { value: "azure.nl-NL-ColetteNeural", label: "Colette (nl-NL)", provider: "Azure", langs: ["nl"] },
  { value: "azure.pl-PL-AgnieszkaNeural", label: "Agnieszka (pl-PL)", provider: "Azure", langs: ["pl"] },
  { value: "azure.tr-TR-EmelNeural", label: "Emel (tr-TR)", provider: "Azure", langs: ["tr"] },
  { value: "azure.sv-SE-SofieNeural", label: "Sofie (sv-SE)", provider: "Azure", langs: ["sv"] },
  { value: "azure.da-DK-ChristelNeural", label: "Christel (da-DK)", provider: "Azure", langs: ["da"] },
  { value: "azure.vi-VN-HoaiMyNeural", label: "HoaiMy (vi-VN)", provider: "Azure", langs: ["vi"] },
  { value: "azure.uk-UA-PolinaNeural", label: "Polina (uk-UA)", provider: "Azure", langs: ["uk"] },
  // Cartesia — wide multilingual support
  { value: "cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab", label: "Customer Support Man", provider: "Cartesia", langs: ["en"] },
  { value: "cartesia.829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30", label: "Customer Support Lady", provider: "Cartesia", langs: ["en"] },
  { value: "cartesia.79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e", label: "Nonfiction Man", provider: "Cartesia", langs: ["en"] },
  { value: "cartesia.15a9cd88-84b0-4a8b-95f2-5d583b54c72e", label: "Reading Lady", provider: "Cartesia", langs: ["en"] },
  { value: "cartesia.00a77add-48d5-4ef6-8157-71e5437b282d", label: "Calm Lady", provider: "Cartesia", langs: ["en"] },
  { value: "cartesia.3f4ade23-6eb4-4279-ab05-6a144947c4d5", label: "German Woman", provider: "Cartesia", langs: ["de"] },
  { value: "cartesia.384b625b-da5d-49e8-a76d-a2855d4f31eb", label: "German Man", provider: "Cartesia", langs: ["de"] },
  { value: "cartesia.a249eaff-1e96-4d2c-b23b-12efa4f66f41", label: "French Lady", provider: "Cartesia", langs: ["fr"] },
  { value: "cartesia.ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3", label: "French Man", provider: "Cartesia", langs: ["fr"] },
  { value: "cartesia.a67e0421-22e0-4d5b-b586-bd4a64aee41d", label: "Spanish Man", provider: "Cartesia", langs: ["es"] },
  { value: "cartesia.2deb3edf-b9d8-4d06-8db9-5742fb8a3cb2", label: "Spanish Lady", provider: "Cartesia", langs: ["es"] },
  { value: "cartesia.44863732-e415-4084-8ba1-deabe34ce3d2", label: "Japanese Woman", provider: "Cartesia", langs: ["ja"] },
  { value: "cartesia.e8a863c6-22c7-4671-86ca-91cacffc038d", label: "Japanese Man", provider: "Cartesia", langs: ["ja"] },
  { value: "cartesia.e90c6678-f0d3-4767-9883-5d0ecf5894a8", label: "Chinese Woman", provider: "Cartesia", langs: ["zh"] },
  { value: "cartesia.eda5bbff-1ff1-4886-8ef1-4e69a77640a0", label: "Chinese Man", provider: "Cartesia", langs: ["zh"] },
  { value: "cartesia.663afeec-d082-4ab5-827e-2e41bf73a25b", label: "Korean Woman", provider: "Cartesia", langs: ["ko"] },
  { value: "cartesia.57dba6ff-fe3b-479d-836e-06f5a61cb5de", label: "Korean Man", provider: "Cartesia", langs: ["ko"] },
  { value: "cartesia.3b554273-4299-48b9-9aaf-eefd438e3941", label: "Indian Lady", provider: "Cartesia", langs: ["hi"] },
  { value: "cartesia.638efaaa-4d0c-442e-b701-3fae16aad012", label: "Indian Man", provider: "Cartesia", langs: ["hi"] },
  { value: "cartesia.0e21713a-5e9a-428a-bed4-90d410b87f13", label: "Italian Woman", provider: "Cartesia", langs: ["it"] },
  { value: "cartesia.029c3c7a-b6d9-44f0-814b-200d849830ff", label: "Italian Man", provider: "Cartesia", langs: ["it"] },
  { value: "cartesia.700d1ee3-a641-4018-ba6e-899dcadc9e2b", label: "Brazilian Lady", provider: "Cartesia", langs: ["pt"] },
  { value: "cartesia.6a16c1f4-462b-44de-998d-ccdaa4125a0a", label: "Brazilian Man", provider: "Cartesia", langs: ["pt"] },
  { value: "cartesia.779673f3-895f-4935-b6b5-b031dc78b319", label: "Russian Lady", provider: "Cartesia", langs: ["ru"] },
  { value: "cartesia.2b3bb17d-26b9-421f-b8ca-1dd92332279f", label: "Russian Man", provider: "Cartesia", langs: ["ru"] },
  { value: "cartesia.9e8db62d-056f-47f3-b3b6-1b05767f9176", label: "Dutch Man", provider: "Cartesia", langs: ["nl"] },
  { value: "cartesia.575a5d29-1fdc-4d4e-9afa-5a9a71759864", label: "Polish Woman", provider: "Cartesia", langs: ["pl"] },
  { value: "cartesia.3d335974-4c4a-400a-84dc-ebf4b73aada6", label: "Polish Man", provider: "Cartesia", langs: ["pl"] },
  { value: "cartesia.5a31e4fb-f823-4359-aa91-82c0ae9a991c", label: "Turkish Man", provider: "Cartesia", langs: ["tr"] },
  { value: "cartesia.38a146c3-69d7-40ad-aada-76d5a2621758", label: "Swedish Man", provider: "Cartesia", langs: ["sv"] },
  { value: "cartesia.f852eb8d-a177-48cd-bf63-7e4dcab61a36", label: "Swedish Lady", provider: "Cartesia", langs: ["sv"] },
];

// Get the base language code from a full locale (e.g., "en-US" -> "en", "zh-CN" -> "zh")
function getBaseLang(langCode) {
  if (!langCode || langCode === "multi") return null;
  return langCode.split("-")[0];
}

// Filter voices that support a given language
function getVoicesForLanguage(langCode) {
  if (!langCode || langCode === "multi") return VOICE_OPTIONS;
  const base = getBaseLang(langCode);
  return VOICE_OPTIONS.filter(
    (v) => v.langs === ALL_LANGS || (Array.isArray(v.langs) && v.langs.includes(base))
  );
}

// Language options
const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-IN", label: "English (India)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-419", label: "Spanish (Latin America)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "fr-CA", label: "French (Canada)" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ko-KR", label: "Korean" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv-SE", label: "Swedish" },
  { value: "da-DK", label: "Danish" },
  { value: "tr", label: "Turkish" },
  { value: "vi", label: "Vietnamese" },
  { value: "uk", label: "Ukrainian" },
  { value: "multi", label: "Multilingual (auto-detect)" },
];

// Available functions
const AVAILABLE_FUNCTIONS = [
  { value: 'transfer_to_human', label: 'Transfer to Human', description: 'Transfer the call to a real phone number' },
{ value: 'send_summary_sms', label: 'Send SMS', description: 'Send text messages — summaries, confirmations, or custom messages' },
  { value: 'schedule_callback', label: 'Schedule Callback', description: 'Collect callback request details and preferred time' },
  { value: 'check_business_hours', label: 'Check Business Hours', description: 'Report if business is open or closed (configurable hours)' },
  { value: 'collect_customer_info', label: 'Collect Customer Info', description: 'Gather name, email, phone, company — shown in call logs' },
  { value: 'search_knowledge', label: 'Search Knowledge Base', description: 'Search uploaded documents to answer caller questions (requires documents)' },
  { value: 'send_email', label: 'Send Email', description: 'Send follow-up emails via SendGrid integration' },
  { value: 'end_call', label: 'End Call', description: 'Politely end the call with a hangup' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHostFromDomain(domain) {
  if (!domain) return null;
  try {
    return new URL(domain).host;
  } catch {
    return null;
  }
}

function getWebhookHost(webhookUrl) {
  if (!webhookUrl) return null;
  try {
    const cleaned = webhookUrl.replace(/^(https?:\/\/)[^@]+@/, "$1");
    return new URL(cleaned).host;
  } catch {
    return null;
  }
}

function isEmployeeStale(employee, currentDomain) {
  if (!currentDomain || !employee.webhookUrl) return false;
  const currentHost = getHostFromDomain(currentDomain);
  const webhookHost = getWebhookHost(employee.webhookUrl);
  return currentHost && webhookHost && currentHost !== webhookHost;
}

function getCredentials() {
  try {
    const session = localStorage.getItem("sally_sales_session");
    if (!session) return null;
    return JSON.parse(session).credentials;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stale Webhook Banner (page-level)
// ---------------------------------------------------------------------------

function StaleWebhookBanner({
  staleCount,
  fixingAll,
  fixAllResult,
  onFixAll,
}) {
  if (staleCount === 0) return null;

  return (
    <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={20} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            {staleCount} employee{staleCount !== 1 ? "s" : ""}{" "}
            {staleCount !== 1 ? "have" : "has"} outdated webhook
            {staleCount !== 1 ? "s" : ""}
          </h3>
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
            {staleCount === 1
              ? "This employee's webhook points"
              : "These employees' webhooks point"}{" "}
            to an old domain. Incoming calls will fail until the webhooks are
            updated to the current domain.
          </p>

          {/* Fix all result */}
          {fixAllResult && (
            <p
              className={`mt-2 text-sm flex items-center gap-1.5 ${
                fixAllResult.type === "success"
                  ? "text-green-700 dark:text-green-400"
                  : fixAllResult.type === "warning"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {fixAllResult.type === "success" ? (
                <CheckCircle size={14} className="shrink-0" />
              ) : (
                <XCircle size={14} className="shrink-0" />
              )}
              {fixAllResult.text}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onFixAll}
              disabled={fixingAll}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {fixingAll ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span>{fixingAll ? "Fixing..." : "Fix All Webhooks"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDomain, setCurrentDomain] = useState(null);

  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [assigningPhone, setAssigningPhone] = useState(null); // employeeId being assigned to
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Webhook fix state
  const [fixingEmployees, setFixingEmployees] = useState({}); // { [id]: { status, message? } }
  const [fixingAll, setFixingAll] = useState(false);
  const [fixAllResult, setFixAllResult] = useState(null);

  useEffect(() => {
    loadEmployees();
    fetchCurrentDomain();
    loadPhoneNumbers();
    if (searchParams.get("new") === "true") {
      setShowCreateForm(true);
      if (location.state?.template) {
        setTemplateData(location.state.template);
      }
      setSearchParams({}, { replace: true });
    }
  }, []);

  const loadPhoneNumbers = async () => {
    try {
      const res = await fetch("/api/signalwire/phone-numbers");
      if (res.ok) {
        const data = await res.json();
        if (data.success) setPhoneNumbers(data.phoneNumbers || []);
      }
    } catch (err) {
      console.warn("Failed to load phone numbers:", err.message);
    }
  };

  const handleAssignPhone = async (employeeId, phoneNumber) => {
    setPhoneLoading(true);
    try {
      const res = await fetch("/api/signalwire/assign-phone-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign phone number");

      // Refresh employees and phone numbers
      await loadEmployees();
      await loadPhoneNumbers();
      setAssigningPhone(null);
      alert(`Phone number ${phoneNumber} assigned successfully!`);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleUnassignPhone = async (employeeId) => {
    if (!window.confirm("Unassign this phone number? Inbound calls will stop routing to this agent.")) return;
    setPhoneLoading(true);
    try {
      const res = await fetch("/api/signalwire/assign-phone-number", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unassign");
      await loadEmployees();
      await loadPhoneNumbers();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setPhoneLoading(false);
    }
  };

  const fetchCurrentDomain = async () => {
    try {
      const res = await fetch("/api/settings/domain");
      const data = await res.json();
      if (data.success && data.domain) {
        setCurrentDomain(data.domain);
      }
    } catch (err) {
      console.warn("Failed to fetch current domain:", err.message);
    }
  };

  const loadEmployees = async () => {
    try {
      // Load from API (DB-backed)
      let projectId;
      try {
        const session = JSON.parse(localStorage.getItem("sally_sales_session") || "{}");
        projectId = session.credentials?.projectId;
      } catch { /* ignore */ }

      let empUrl = "/api/employees/sync";
      if (projectId) empUrl += `?projectId=${encodeURIComponent(projectId)}`;

      const res = await fetch(empUrl);
      const data = await res.json();
      if (data.success && data.employees) {
        setEmployees(data.employees);
        // Keep localStorage in sync as a client-side cache
        localStorage.setItem("sally_sales_employees", JSON.stringify(data.employees));
      } else {
        // Fallback to localStorage
        const employeesData = localStorage.getItem("sally_sales_employees");
        setEmployees(employeesData ? JSON.parse(employeesData) : []);
      }
    } catch (error) {
      console.error("Failed to load employees:", error);
      // Fallback to localStorage
      try {
        const employeesData = localStorage.getItem("sally_sales_employees");
        setEmployees(employeesData ? JSON.parse(employeesData) : []);
      } catch {
        setEmployees([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveEmployees = (newEmployees) => {
    localStorage.setItem("sally_sales_employees", JSON.stringify(newEmployees));
    setEmployees(newEmployees);
    syncEmployeesToServer(newEmployees);
  };

  /** Persist the employee list to the SQLite database so the SWML proxy
   *  can read it and lazily re-create agents after a backend restart. */
  const syncEmployeesToServer = (emps) => {
    let projectId;
    try {
      const session = JSON.parse(localStorage.getItem("sally_sales_session") || "{}");
      projectId = session.credentials?.projectId;
    } catch { /* ignore */ }

    fetch("/api/employees/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees: emps, projectId }),
    }).catch((err) => console.warn("Employee sync failed:", err.message));
  };

  // Compute stale employees
  const staleEmployees = employees.filter((emp) =>
    isEmployeeStale(emp, currentDomain),
  );

  // --- Employee CRUD ---

  const handleCreateEmployee = async (employeeData) => {
    try {
      // Server gets credentials from JWT session cookie automatically.
      // We pass localStorage credentials as fallback for backward compatibility.
      const credentials = getCredentials() || {};

      const response = await fetch("/api/signalwire/create-virtual-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeData, credentials }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create virtual employee");
      }

      const result = await response.json();
      const newEmployee = result.employee;

      saveEmployees([...employees, newEmployee]);
      setShowCreateForm(false);

      alert(
        `Virtual Employee "${newEmployee.name}" created successfully!\n\nCall Address: ${newEmployee.callFabricAddress}`,
      );
    } catch (error) {
      console.error("Error creating employee:", error);
      alert("Failed to create virtual employee: " + error.message);
    }
  };

  const handleUpdateEmployee = (employeeData) => {
    const updatedEmployees = employees.map((emp) =>
      emp.id === editingEmployee.id ? { ...emp, ...employeeData } : emp,
    );
    saveEmployees(updatedEmployees);
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (employeeId) => {
    if (window.confirm("Are you sure you want to delete this virtual employee?")) {
      const updatedEmployees = employees.filter((emp) => emp.id !== employeeId);
      saveEmployees(updatedEmployees);
    }
  };

  // --- Webhook fix functions ---

  const fixEmployeeWebhook = async (employee) => {
    setFixingEmployees((prev) => ({
      ...prev,
      [employee.id]: { status: "fixing" },
    }));

    try {
      const credentials = getCredentials();
      if (!credentials) {
        setFixingEmployees((prev) => ({
          ...prev,
          [employee.id]: { status: "error", message: "Not logged in. Please sign in first." },
        }));
        return;
      }

      if (!employee.resourceId) {
        setFixingEmployees((prev) => ({
          ...prev,
          [employee.id]: {
            status: "error",
            message: "No SignalWire resource ID stored for this employee. Recreate the employee to fix this.",
          },
        }));
        return;
      }

      // Fix the webhook — the API derives the domain from the live request,
      // so if the user can see this page the domain is provably active.
      const res = await fetch("/api/signalwire/fix-employee-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          resourceId: employee.resourceId,
          credentials,
        }),
      });
      const result = await res.json();

      if (result.success) {
        // Update localStorage with new webhook URL and sync stored domain
        const updatedEmployees = employees.map((emp) =>
          emp.id === employee.id
            ? { ...emp, webhookUrl: result.webhookUrl }
            : emp,
        );
        saveEmployees(updatedEmployees);
        if (result.domain) setCurrentDomain(result.domain);

        setFixingEmployees((prev) => ({
          ...prev,
          [employee.id]: { status: "success" },
        }));

        // Clear success after 3s
        setTimeout(() => {
          setFixingEmployees((prev) => {
            const next = { ...prev };
            delete next[employee.id];
            return next;
          });
        }, 3000);
      } else {
        setFixingEmployees((prev) => ({
          ...prev,
          [employee.id]: {
            status: "error",
            message: result.error || "Unknown error",
          },
        }));
      }
    } catch (err) {
      setFixingEmployees((prev) => ({
        ...prev,
        [employee.id]: { status: "error", message: err.message },
      }));
    }
  };

  const fixAllWebhooks = async () => {
    setFixingAll(true);
    setFixAllResult(null);

    try {
      const credentials = getCredentials();
      if (!credentials) {
        setFixAllResult({ type: "error", text: "Not logged in. Please sign in first." });
        return;
      }

      // Reconcile all webhooks — the API derives the domain from the live
      // request, so no separate health check is needed.
      const res = await fetch("/api/signalwire/reconcile-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });
      const result = await res.json();

      if (result.success) {
        // Update localStorage for fixed employees
        if (result.updated?.length > 0) {
          const updatedEmployees = employees.map((emp) => {
            const match = result.updated.find((u) => u.id === emp.resourceId);
            return match ? { ...emp, webhookUrl: match.newUrl } : emp;
          });
          saveEmployees(updatedEmployees);
        }

        // Re-fetch stored domain since reconcile may have updated it
        fetchCurrentDomain();

        const parts = [];
        if (result.updated?.length) parts.push(`${result.updated.length} fixed`);
        if (result.unchanged?.length) parts.push(`${result.unchanged.length} already current`);
        if (result.errors?.length) parts.push(`${result.errors.length} failed`);

        setFixAllResult({
          type: result.errors?.length ? "warning" : "success",
          text: parts.join(", ") || "No webhook resources found",
        });
      } else {
        setFixAllResult({
          type: "error",
          text: result.error || "Reconciliation failed",
        });
      }
    } catch (err) {
      setFixAllResult({ type: "error", text: err.message });
    } finally {
      setFixingAll(false);
    }
  };

  // --- Filtering ---

  const filteredEmployees = employees.filter((employee) => {
    const query = searchQuery.toLowerCase();
    return (
      employee.name?.toLowerCase().includes(query) ||
      employee.role?.toLowerCase().includes(query)
    );
  });

  if (showCreateForm || editingEmployee) {
    return (
      <VirtualEmployeeForm
        employee={editingEmployee}
        template={templateData}
        onSave={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
        onCancel={() => {
          setShowCreateForm(false);
          setEditingEmployee(null);
          setTemplateData(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Virtual Employees
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI voice agents powered by SignalWire
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
        >
          <Plus size={20} />
          <span>Create Virtual Employee</span>
        </button>
      </div>

      {/* Stale Webhook Banner */}
      <StaleWebhookBanner
        staleCount={staleEmployees.length}
        fixingAll={fixingAll}
        fixAllResult={fixAllResult}
        onFixAll={fixAllWebhooks}
      />

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Employees List */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <Users
              className="mx-auto text-gray-400 dark:text-gray-600 mb-4"
              size={64}
            />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? "No employees found" : "No virtual employees yet"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery
                ? "Try adjusting your search query"
                : "Create your first AI voice agent to get started"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus size={20} />
                <span>Create Your First Virtual Employee</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              currentDomain={currentDomain}
              fixState={fixingEmployees[employee.id] || null}
              onFix={() => fixEmployeeWebhook(employee)}
              onEdit={() => setEditingEmployee(employee)}
              onDelete={() => handleDeleteEmployee(employee.id)}
              phoneNumbers={phoneNumbers}
              assigningPhone={assigningPhone}
              phoneLoading={phoneLoading}
              onAssignPhone={(phoneNumber) => handleAssignPhone(employee.id, phoneNumber)}
              onUnassignPhone={() => handleUnassignPhone(employee.id)}
              onToggleAssign={() => setAssigningPhone(assigningPhone === employee.id ? null : employee.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Card
// ---------------------------------------------------------------------------

function EmployeeCard({ employee, currentDomain, fixState, onFix, onEdit, onDelete, phoneNumbers, assigningPhone, phoneLoading, onAssignPhone, onUnassignPhone, onToggleAssign }) {
  const [copied, setCopied] = useState(false);
  const { initiateCall, calling } = useCallWidget();

  const stale = isEmployeeStale(employee, currentDomain);
  const webhookHost = getWebhookHost(employee.webhookUrl);
  const currentHost = getHostFromDomain(currentDomain);

  const handleCopyAddress = () => {
    if (employee.callFabricAddress) {
      navigator.clipboard.writeText(employee.callFabricAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCall = async () => {
    if (!employee.callFabricAddress) {
      alert("No call address available for this employee");
      return;
    }
    await initiateCall(employee.callFabricAddress, {
      employeeName: employee.name,
      employeeRole: employee.role,
      employeeId: employee.id,
    });
  };

  const isFixing = fixState?.status === "fixing";
  const fixSuccess = fixState?.status === "success";
  const fixError = fixState?.status === "error";

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6 hover:shadow-xl transition-shadow ${
        stale && !fixSuccess
          ? "border-amber-300 dark:border-amber-600"
          : fixSuccess
          ? "border-green-300 dark:border-green-600"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <Users className="text-white" size={24} />
          </div>
          {stale && !fixSuccess && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-white" size={12} />
            </div>
          )}
          {fixSuccess && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="text-white" size={12} />
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          {/* Fix button (visible when stale) */}
          {stale && !fixSuccess && (
            <button
              onClick={onFix}
              disabled={isFixing}
              className="p-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors disabled:opacity-50"
              title="Fix webhook URL"
            >
              {isFixing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          )}
          <button
            onClick={handleCall}
            disabled={calling || !employee.callFabricAddress}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              employee.callFabricAddress
                ? "Video call this agent"
                : "No call address available"
            }
          >
            {calling ? (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Video size={16} />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {employee.name || "Unnamed Employee"}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {employee.role || "No role specified"}
      </p>

      {/* Webhook error banner */}
      {stale && !fixSuccess && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="text-amber-500 mt-0.5 shrink-0"
              size={14}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Webhook outdated
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Points to{" "}
                <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-800/40 rounded font-mono">
                  {webhookHost}
                </code>{" "}
                instead of{" "}
                <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-800/40 rounded font-mono">
                  {currentHost}
                </code>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Calls to this agent will fail until fixed.
              </p>

              {/* Inline fix button */}
              <button
                onClick={onFix}
                disabled={isFixing}
                className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
              >
                {isFixing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                <span>{isFixing ? "Fixing..." : "Fix Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix success message */}
      {fixSuccess && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-500 shrink-0" size={14} />
            <p className="text-sm text-green-700 dark:text-green-400">
              Webhook updated successfully
            </p>
          </div>
        </div>
      )}

      {/* Fix error message */}
      {fixError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <XCircle className="text-red-500 mt-0.5 shrink-0" size={14} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Fix failed
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5 break-words">
                {fixState.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Call Fabric Address */}
      {employee.callFabricAddress && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Call Address
            </span>
            <button
              onClick={handleCopyAddress}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1"
            >
              {copied ? (
                <>
                  <Check size={12} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <code className="text-sm text-gray-900 dark:text-white font-mono">
            {employee.callFabricAddress}
          </code>
        </div>
      )}

      {/* Phone Number Assignment */}
      {employee.phone_number ? (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone size={14} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {employee.phone_number}
              </span>
            </div>
            <button
              onClick={onUnassignPhone}
              disabled={phoneLoading}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
            >
              Unassign
            </button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
            Inbound calls route to this agent
          </p>
        </div>
      ) : employee.resourceId && phoneNumbers?.length > 0 ? (
        <div className="mb-4">
          {assigningPhone === employee.id ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
                  Assign Phone Number
                </span>
                <button onClick={onToggleAssign} className="text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
              <div className="space-y-1">
                {phoneNumbers
                  .filter((n) => !n.assignedTo)
                  .map((num) => (
                    <button
                      key={num.sid}
                      onClick={() => onAssignPhone(num.phoneNumber)}
                      disabled={phoneLoading}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors disabled:opacity-50"
                    >
                      <span className="font-mono text-blue-900 dark:text-blue-200">
                        {num.phoneNumber}
                      </span>
                      {num.capabilities?.sms && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">SMS</span>
                      )}
                    </button>
                  ))}
                {phoneNumbers.filter((n) => !n.assignedTo).length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-1">
                    All numbers are assigned
                  </p>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onToggleAssign}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Phone size={12} />
              <span>Assign Phone Number</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Voice & Language */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <Mic size={14} />
          <span>
            {VOICE_OPTIONS.find((v) => v.value === employee.voice)?.label ||
              employee.voice}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <Globe size={14} />
          <span>
            {LANGUAGE_OPTIONS.find((l) => l.value === employee.language)
              ?.label || employee.language}
          </span>
        </div>
      </div>

      {employee.greeting && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          "{employee.greeting}"
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Form
// ---------------------------------------------------------------------------

function VirtualEmployeeForm({ employee, template, onSave, onCancel }) {
  // Merge: existing employee data > template data > defaults
  const source = employee || template || {};
  const credentials = getCredentials();
  const editingEmployee = employee;
  const initialData = source;

  const [formData, setFormData] = useState({
    name: source.name || "",
    id: source.id || "",
    role: source.role || "",
    greeting: source.greeting || "",
    prompt: source.prompt || "",
    voice: source.voice || "openai.nova",
    language: source.language || "en-US",
    temperature: source.temperature ?? 0.7,
    speech_hints: source.speech_hints || [],
    enabled_functions: source.enabled_functions || ["transfer_to_human", "send_summary_sms", "end_call"],
    transfer_number: source.transfer_number || "",
    transfer_from: source.transfer_from || "",
    sms_from_number: source.sms_from_number || "",
    video_idle_url: source.video_idle_url || "",
    video_talking_url: source.video_talking_url || "",
    business_hours_start: initialData?.business_hours_start ?? initialData?.businessHoursStart ?? 9,
    business_hours_end: initialData?.business_hours_end ?? initialData?.businessHoursEnd ?? 18,
    business_days: initialData?.business_days ?? initialData?.businessDays ?? [0, 1, 2, 3, 4],
    documents: initialData?.documents ?? [],
    email_provider: initialData?.email_provider ?? initialData?.emailProvider ?? '',
    sendgrid_api_key: initialData?.sendgrid_api_key ?? initialData?.sendgridApiKey ?? '',
    email_from_address: initialData?.email_from_address ?? initialData?.emailFromAddress ?? '',
    email_from_name: initialData?.email_from_name ?? initialData?.emailFromName ?? '',
  });
  const [errors, setErrors] = useState({});
  const [newHint, setNewHint] = useState("");
  const [saving, setSaving] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.role.trim()) {
      newErrors.role = "Role is required";
    }
    if (!formData.greeting.trim()) {
      newErrors.greeting = "Greeting is required";
    }
    if (!formData.prompt.trim()) {
      newErrors.prompt = "Instructions are required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setSaving(true);
      try {
        await onSave(formData);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const addSpeechHint = () => {
    if (newHint.trim() && !formData.speech_hints.includes(newHint.trim())) {
      handleChange("speech_hints", [...formData.speech_hints, newHint.trim()]);
      setNewHint("");
    }
  };

  const removeSpeechHint = (hint) => {
    handleChange(
      "speech_hints",
      formData.speech_hints.filter((h) => h !== hint),
    );
  };

  const toggleFunction = (funcValue) => {
    const current = formData.enabled_functions;
    if (current.includes(funcValue)) {
      handleChange(
        "enabled_functions",
        current.filter((f) => f !== funcValue),
      );
    } else {
      handleChange("enabled_functions", [...current, funcValue]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onCancel}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {employee ? "Edit Virtual Employee" : "Create Virtual Employee"}
              </h2>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Users size={20} />
              <span>Basic Information</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.name
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="e.g., Sarah Sales Agent"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role *
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.role
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="e.g., Customer Support Agent"
                />
                {errors.role && (
                  <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Greeting Message *
                </label>
                <input
                  type="text"
                  value={formData.greeting}
                  onChange={(e) => handleChange("greeting", e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.greeting
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="e.g., Hello! I'm Sarah, how can I help you today?"
                />
                {errors.greeting && (
                  <p className="mt-1 text-sm text-red-600">{errors.greeting}</p>
                )}
              </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Zap size={20} />
              <span>AI Configuration</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructions / Prompt *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => handleChange("prompt", e.target.value)}
                  rows={6}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.prompt
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="Describe the agent's responsibilities, knowledge base, and behavior. For example: You are a customer support agent for Acme Corp. You help customers with order tracking, product questions, and technical support..."
                />
                {errors.prompt && (
                  <p className="mt-1 text-sm text-red-600">{errors.prompt}</p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Provide detailed instructions about the agent's role,
                  capabilities, and how it should interact with callers.
                </p>
              </div>
            </div>
          </div>

          {/* Voice & Language */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Mic size={20} />
              <span>Voice & Language</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice
                </label>
                <select
                  value={formData.voice}
                  onChange={(e) => handleChange("voice", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {Object.entries(
                    getVoicesForLanguage(formData.language).reduce((groups, voice) => {
                      const group = voice.provider || "Other";
                      if (!groups[group]) groups[group] = [];
                      groups[group].push(voice);
                      return groups;
                    }, {})
                  ).map(([provider, voices]) => (
                    <optgroup key={provider} label={provider}>
                      {voices.map((voice) => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    handleChange("language", newLang);
                    // If current voice isn't compatible with new language, reset to first available
                    const available = getVoicesForLanguage(newLang);
                    if (!available.some((v) => v.value === formData.voice)) {
                      handleChange("voice", available[0]?.value || "openai.nova");
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Sliders size={20} />
              <span>Advanced Settings</span>
            </h3>
            <div className="space-y-4">
              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature: {formData.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) =>
                    handleChange("temperature", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Controls randomness: 0 is focused and deterministic, 1 is
                  creative and varied
                </p>
              </div>

              {/* Speech Hints */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Speech Recognition Hints
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addSpeechHint())
                    }
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Add a word or phrase..."
                  />
                  <button
                    type="button"
                    onClick={addSpeechHint}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.speech_hints.map((hint, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                    >
                      <span className="text-sm">{hint}</span>
                      <button
                        type="button"
                        onClick={() => removeSpeechHint(hint)}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add keywords to improve speech recognition accuracy
                </p>
              </div>

              {/* Enabled Functions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enabled Functions
                </label>
                <div className="space-y-2">
                  {AVAILABLE_FUNCTIONS.map((func) => (
                    <label
                      key={func.value}
                      className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.enabled_functions.includes(
                          func.value,
                        )}
                        onChange={() => toggleFunction(func.value)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {func.label}
                        </span>
                        {func.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {func.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Function Configuration — phone numbers for transfer & SMS */}
              {(formData.enabled_functions?.includes("transfer_to_human") ||
                formData.enabled_functions?.includes("send_summary_sms")) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    Phone Number Configuration
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">
                    Configure phone numbers for enabled functions. Leave blank to gracefully skip the action.
                  </p>

                  {formData.enabled_functions?.includes('transfer_to_human') && (
                    <>
                      <PhoneNumberPicker
                        value={formData.transfer_number}
                        onChange={(val) => setFormData(prev => ({ ...prev, transfer_number: val }))}
                        label="Transfer To Number"
                        placeholder="+15551234567"
                        credentials={credentials}
                      />
                      <div style={{ marginTop: '0.5rem' }}>
                        <PhoneNumberPicker
                          value={formData.transfer_from}
                          onChange={(val) => setFormData(prev => ({ ...prev, transfer_from: val }))}
                          label="Transfer From (Caller ID override, optional)"
                          placeholder="+15551234567"
                          credentials={credentials}
                        />
                      </div>
                    </>
                  )}

                  {formData.enabled_functions?.includes('send_summary_sms') && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <PhoneNumberPicker
                        value={formData.sms_from_number}
                        onChange={(val) => setFormData(prev => ({ ...prev, sms_from_number: val }))}
                        label="SMS From Number"
                        placeholder="+15551234567"
                        credentials={credentials}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Business Hours Configuration */}
              {formData.enabled_functions?.includes('check_business_hours') && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Business Hours</h4>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Open</label>
                      <select
                        value={formData.business_hours_start}
                        onChange={(e) => setFormData(prev => ({ ...prev, business_hours_start: parseInt(e.target.value) }))}
                        style={{ display: 'block', padding: '0.375rem', borderRadius: '0.25rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{`${i % 12 || 12}:00 ${i < 12 ? 'AM' : 'PM'}`}</option>
                        ))}
                      </select>
                    </div>
                    <span style={{ marginTop: '1rem' }}>to</span>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Close</label>
                      <select
                        value={formData.business_hours_end}
                        onChange={(e) => setFormData(prev => ({ ...prev, business_hours_end: parseInt(e.target.value) }))}
                        style={{ display: 'block', padding: '0.375rem', borderRadius: '0.25rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{`${i % 12 || 12}:00 ${i < 12 ? 'AM' : 'PM'}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Open Days</label>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setFormData(prev => {
                              const days = prev.business_days || [];
                              return {
                                ...prev,
                                business_days: days.includes(idx) ? days.filter(d => d !== idx) : [...days, idx].sort(),
                              };
                            });
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            backgroundColor: (formData.business_days || []).includes(idx) ? '#044cf6' : 'white',
                            color: (formData.business_days || []).includes(idx) ? 'white' : '#333',
                            cursor: 'pointer',
                          }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Configuration (SendGrid) */}
              {formData.enabled_functions?.includes('send_email') && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Email Configuration (SendGrid)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>SendGrid API Key</label>
                      <input
                        type="password"
                        value={formData.sendgrid_api_key}
                        onChange={(e) => setFormData(prev => ({ ...prev, sendgrid_api_key: e.target.value, email_provider: e.target.value ? 'sendgrid' : '' }))}
                        placeholder="SG.xxxxxxxxxx"
                        style={{ display: 'block', width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>From Email Address</label>
                      <input
                        type="email"
                        value={formData.email_from_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, email_from_address: e.target.value }))}
                        placeholder="noreply@yourcompany.com"
                        style={{ display: 'block', width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>From Name (optional)</label>
                      <input
                        type="text"
                        value={formData.email_from_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, email_from_name: e.target.value }))}
                        placeholder="Defaults to employee name"
                        style={{ display: 'block', width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Knowledge Base */}
              {formData.enabled_functions?.includes('search_knowledge') && (
                <KnowledgeBaseTab
                  documents={formData.documents || []}
                  employeeId={formData.id || editingEmployee?.id}
                  credentials={credentials}
                  onDocumentsChange={(docs) => setFormData(prev => ({ ...prev, documents: docs }))}
                />
              )}
            </div>
          </div>

          {/* Video Avatar */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Video size={20} />
              <span>Video Avatar</span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              URLs to .mp4 video files shown during calls. Leave blank to use defaults.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Idle Video URL
                </label>
                <input
                  type="url"
                  value={formData.video_idle_url}
                  onChange={(e) => handleChange("video_idle_url", e.target.value)}
                  placeholder="/videos/sally_idle.mp4"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Looping video shown when the agent is listening
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Talking Video URL
                </label>
                <input
                  type="url"
                  value={formData.video_talking_url}
                  onChange={(e) => handleChange("video_talking_url", e.target.value)}
                  placeholder="/videos/sally_talking.mp4"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Video shown when the agent is speaking
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>
                    {employee ? "Save Changes" : "Create Virtual Employee"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
