# Sally Sales - AI Voice Agent Demo

A complete SignalWire AI voice application demonstrating browser-to-agent WebRTC calling with dynamic SWML configuration.

## Architecture

```
┌─────────────────────────────────────────┐
│   Browser (React + @signalwire/js)      │
│   - WebRTC audio/video                  │
│   - Real-time event handling            │
│   - Dynamic UI updates                  │
└──────────┬──────────────────────────────┘
           │ WebSocket/WebRTC
           │ Dial: /{subscriberId}/sally-agent
           │
┌──────────▼──────────────────────────────┐
│   SignalWire Cloud Platform             │
│   - Fabric API (Subscriber/Addresses)   │
│   - WebRTC Media Gateway                │
│   - Speech-to-Text / Text-to-Speech     │
│   - AI Orchestration (SWML)             │
└──────────┬──────────────────────────────┘
           │ HTTPS + Basic Auth
           │ GET /swml (fetch SWML document)
           │ POST /swaig/{function} (call functions)
           │
┌──────────▼──────────────────────────────┐
│   Python Agent Backend                  │
│   signalwire-agents SDK                 │
│   - Serves SWML dynamically             │
│   - Handles SWAIG function calls        │
│   - Sends real-time events to browser   │
│   - Updates config from UI              │
│   URL: https://jonnykarate.ngrok.io     │
└─────────────────────────────────────────┘
```

## How It Works

### 1. **User Creates Agent Configuration** (UI)
- User enters natural language prompt describing their IVR menu
- Example: "I run a pizza shop. Customers can: 1) Order pizza, 2) Check delivery status, 3) Speak to manager"
- UI sends prompt to `/api/signalwire/generate-agent`

### 2. **Backend Configuration** (Node.js API)
The `/api/signalwire/generate-agent` endpoint:

1. **Updates Python Backend** - Sends POST to `https://jonnykarate.ngrok.io/api/update-config` with the prompt
2. **Creates SignalWire Subscriber** - Creates/updates subscriber in SignalWire Fabric API
3. **Creates Address** - Creates address pointing to Python backend:
   ```json
   {
     "name": "sally-agent",
     "type": "swml",
     "swml_url": "https://jonnykarate.ngrok.io/swml"
   }
   ```
4. **Returns Call Destination** - Returns `/{subscriberId}/sally-agent` to the UI

### 3. **Python Agent** (signalwire-agents)
The Python backend at `https://jonnykarate.ngrok.io`:

- **Receives Configuration Updates** - `/api/update-config` updates agent personality
- **Serves SWML** - `/swml` endpoint serves dynamic SWML configuration
- **Handles SWAIG Functions** - `/swaig/{function}` handles tool calls:
  - `route_to_order` - Route to order department
  - `demo_order_item` - Add items to cart
  - `demo_get_status` - Check order status
  - `transfer_call` - Transfer to human
- **Sends Real-Time Events** - Uses `swml_user_event()` to send updates to browser

### 4. **Browser Calls Agent** (WebRTC)
```javascript
// Initialize SignalWire client
const client = await SignalWire.SignalWire({
    token: 'fabric-token-from-backend',
    fabric: { audio: true, video: false }
});

// Listen for real-time events from agent
client.on('userInput', (event) => {
    // Handle events: item_added, routing_decision, etc.
    console.log('Agent event:', event.detail);
});

// Dial the agent address
const call = await client.dial({
    to: '/subscriber_123/sally-agent',  // Format: /{subscriberId}/{addressName}
    audio: true,
    video: false
});

await call.start();
```

### 5. **Call Flow**

1. **Browser dials** `/{subscriberId}/sally-agent`
2. **SignalWire looks up address** → finds `swml_url: https://jonnykarate.ngrok.io/swml`
3. **SignalWire fetches SWML** → `GET https://jonnykarate.ngrok.io/swml`
4. **Python agent returns SWML** → Contains AI configuration, voice settings, SWAIG functions
5. **SignalWire processes call** → AI starts conversation using SWML
6. **AI calls functions** → `POST https://jonnykarate.ngrok.io/swaig/demo_order_item`
7. **Python returns result** → Includes `swml_user_event` data
8. **SignalWire forwards event** → Browser receives via `userInput` event
9. **UI updates in real-time** → Shows order items, routing decisions, etc.

## SignalWire Address Formats

SignalWire supports different address formats for dialing:

| Format | Description | Example |
|--------|-------------|---------|
| `/public/{name}` | Public address (anyone can call) | `/public/holy-guacamole` |
| `/private/{name}` | Private address (authentication required) | `/private/sales-agent` |
| `/{subscriber}/{name}` | Subscriber-specific address | `/demo_user_123/sally-agent` |

## Project Structure

```
Sally-Sales/
├── web/                          # React frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── signalwire/
│   │   │   │       ├── connect/route.js          # Connect to SignalWire
│   │   │   │       ├── generate-agent/route.js   # Create agent & address
│   │   │   │       └── webrtc-token/route.js     # Generate Fabric tokens
│   │   │   └── demo-ivr/page.jsx                  # Main UI
│   │   └── components/demo-ivr/
│   │       ├── AdvancedCallControls.jsx          # WebRTC calling UI
│   │       ├── TranscriptPanel.jsx               # Live transcript
│   │       └── CodeViewer.jsx                    # SWML viewer
│   └── package.json
│
└── agent/                        # Python backend
    ├── main.py                   # Agent implementation
    ├── requirements.txt          # Python dependencies
    └── README.md                 # Agent docs
```

## Setup Instructions

### 1. Install Dependencies

**Frontend:**
```bash
cd web
npm install
```

**Backend:**
```bash
cd agent
pip install -r requirements.txt
```

### 2. Start Python Agent
```bash
cd agent
python main.py
```

Agent runs on `http://localhost:3030`

### 3. Expose with ngrok
```bash
ngrok http 3030 --domain=jonnykarate.ngrok.io
```

Agent accessible at: `https://jonnykarate.ngrok.io/swml`

### 4. Start Frontend
```bash
cd web
npm run dev
```

Frontend runs on `http://localhost:4000`

### 5. Configure Environment

In `web/vite.config.ts`, ensure:
```javascript
define: {
  'process.env.AGENT_BACKEND_URL': JSON.stringify('https://jonnykarate.ngrok.io')
}
```

### 6. Use the Application

1. **Open** http://localhost:4000/demo-ivr
2. **Credentials are pre-filled** with your SignalWire account
3. **Click "Connect"** to authenticate
4. **Edit the prompt** to configure your agent
5. **Click "Generate Agent"** to deploy configuration
6. **Click call button** to talk to your agent via WebRTC

## Real-Time Events

The Python agent sends events to the browser via `swml_user_event()`:

```python
# In Python agent
result = SwaigFunctionResult("I've added that to your order")
result.swml_user_event({
    "type": "item_added",
    "item": {"name": "Pizza", "price": 12.99}
})
return result
```

```javascript
// In browser
client.on('userInput', (event) => {
    if (event.detail.type === 'item_added') {
        updateCartUI(event.detail.item);
    }
});
```

## SignalWire APIs Used

### Fabric API (Subscribers & Addresses)
- `POST /api/fabric/subscribers` - Create subscriber
- `POST /api/fabric/subscribers/{id}/addresses` - Create address pointing to SWML URL
- Used for: Managing call destinations

### SWML (SignalWire Markup Language)
- Dynamic XML/YAML served from Python backend
- Contains: AI configuration, voice settings, SWAIG functions
- Fetched by SignalWire when call connects

### SWAIG (SignalWire AI Gateway)
- Tool/function calling for AI agents
- Python decorators: `@AgentBase.tool()`
- Called by AI during conversation

### Client SDK (@signalwire/js)
- Browser WebRTC calling
- Real-time event streaming
- Audio/video communication

## Comparison to Documentation Examples

### Holy Guacamole Architecture (from docs)

```javascript
// Holy Guacamole uses same pattern:
const DESTINATION = '/public/holy-guacamole';

client = await SignalWire.SignalWire({
    token: STATIC_TOKEN,
    logLevel: 'debug'
});

client.on('userInput', handleUserEvent);

roomSession = await client.dial({
    to: DESTINATION,
    rootElement: videoContainer,
    audio: true,
    video: true
});
```

**Sally Sales is identical**, except:
- ✅ Uses `/{subscriberId}/sally-agent` instead of `/public/holy-guacamole`
- ✅ Generates address dynamically from UI
- ✅ Updates agent configuration in real-time
- ✅ Uses same WebRTC calling pattern
- ✅ Uses same real-time event pattern
- ✅ Uses same Python `signalwire-agents` SDK

## Key Differences from Incorrect Approaches

### ❌ **Wrong: Video API**
```javascript
// DON'T DO THIS
await fetch('/api/video/room_tokens', ...)
```

### ✅ **Correct: Fabric API**
```javascript
// DO THIS
await fetch('/api/fabric/subscribers', ...)
```

### ❌ **Wrong: Client-side SWML**
```javascript
// DON'T DO THIS
const swml = generateSWML(prompt); // in browser
storeInMemory(swml);
```

### ✅ **Correct: Python Backend SWML**
```python
# DO THIS
class SallySalesAgent(AgentBase):
    # SWML generated by signalwire-agents SDK
```

## Production Deployment

### Python Agent
- Deploy to: Railway, Fly.io, Render, etc.
- Set environment: `SWML_BASIC_AUTH_USER`, `SWML_BASIC_AUTH_PASSWORD`
- Expose HTTPS endpoint
- Update `AGENT_BACKEND_URL` in frontend

### Frontend
- Deploy to: Vercel, Netlify, Cloudflare Pages, etc.
- Set `AGENT_BACKEND_URL` environment variable
- Configure SignalWire credentials securely

### SignalWire Configuration
- Use production Space URL
- Generate production API tokens
- Configure webhook authentication
- Set up phone numbers or public addresses

## Troubleshooting

### "Failed to load SignalWire SDK"
- SDK is now installed as npm package
- No CDN loading required
- Check console for "SignalWire SDK loaded from npm package"

### "Failed to connect to SignalWire"
- Verify credentials (Space URL, Project ID, API Token)
- Check SignalWire dashboard for API access
- Ensure credentials have proper permissions

### "Agent backend not responding"
- Verify ngrok is running: `ngrok http 3030 --domain=jonnykarate.ngrok.io`
- Check Python agent is running: `http://localhost:3030/health`
- Test SWML endpoint: `https://jonnykarate.ngrok.io/swml`

### "Call connects but no audio"
- Browser needs microphone permission
- Check browser console for WebRTC errors
- Verify SignalWire Space has AI features enabled

## License

MIT

## Credits

Built with:
- SignalWire Agents SDK (Python)
- @signalwire/js (JavaScript/TypeScript)
- React Router 7
- Tailwind CSS
- SignalWire Cloud Platform
# sally-sales
# sally-sales
