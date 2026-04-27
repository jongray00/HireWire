# Sally Sales - AI Voice Agent Dashboard

## Overview
Full-stack AI voice agent demo built with SignalWire. Users configure virtual AI employees through a web dashboard, and can interact with them via browser-to-agent WebRTC calls.

## Architecture
- **Frontend** (`/web`): React Router 7 + Vite + TypeScript + Tailwind CSS + Chakra UI
  - Runs on port 5000
  - Uses `@signalwire/js` for WebRTC/Fabric calling
  - SQLite database via `better-sqlite3` (server-side only, marked as SSR external in vite.config.ts)
  - State managed with Zustand + TanStack Query
- **Backend** (`/agent`): Python FastAPI + SignalWire Agents SDK
  - Runs on port 8000
  - Serves SWML endpoints for each virtual employee
  - Handles SWAIG functions (transfer, SMS summaries, etc.)

## Key Files
- `web/src/app/demo-ivr/page.jsx` - Main UI for calling
- `web/src/components/demo-ivr/AdvancedCallControls.jsx` - WebRTC call controls
- `web/src/lib/db.ts` - SQLite database (better-sqlite3)
- `agent/main.py` - Python backend with VirtualEmployeeAgent class
- `web/src/app/api/signalwire/` - API routes (connect, token, generate-agent)
- `web/vite.config.ts` - Vite config with SSR externals for better-sqlite3

## Workflows
- **Backend**: `cd agent && python main.py` (port 8000)
- **Frontend**: `cd web && npm run dev` (port 5000)
- **Project**: Runs both in parallel

## Environment Variables Required
- `SIGNALWIRE_SPACE_URL` - SignalWire space URL
- `SIGNALWIRE_PROJECT_ID` - SignalWire project ID
- `SIGNALWIRE_API_TOKEN` - SignalWire API token
- `SWML_BASIC_AUTH_USER` - Basic auth user for SWML endpoint (default: signalwire)
- `SWML_BASIC_AUTH_PASSWORD` - Basic auth password for SWML endpoint
- `APP_DOMAIN` - Public URL of the app (auto-detected in Replit)
- `SENDGRID_API_KEY` - (optional) For SMS/email summaries

## Migration Notes
- Python deps installed via `pip install -r agent/requirements.txt`
- Node deps installed via `npm install` in `/web`
- `better-sqlite3` added to `ssr.external` in `vite.config.ts` so Vite treats it as a server-side native module
- Created missing call-logs UI components: `helpers.js`, `SentimentBadge`, `OutcomeBadge`, `PerformanceRatingBadge`, `CallDetail`
