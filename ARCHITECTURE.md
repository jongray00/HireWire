# Sally Sales - Complete Architecture Guide

## Address Configuration & Calling Flow

### Question: What is the name of the address being dialed?

**Answer**: `sally-agent`

This is configured in `/web/src/app/api/signalwire/generate-agent/route.js`:

```javascript
const addressName = 'sally-agent';  // Line 94
```

### Complete Dial Format

```javascript
// Full address format:
const dialAddress = `/${subscriberId}/sally-agent`;

// Example:
// "/subscriber_1729377893_abc123/sally-agent"
```

---

## SignalWire Client Connection Code

### 1. **Initialization** (Browser)

```javascript
// In: /web/src/components/demo-ivr/AdvancedCallControls.jsx

// Initialize SignalWire client with token
const client = await window.SignalWire.SignalWire({
    token: fabricToken,  // JWT token from /api/signalwire/webrtc-token
    logLevel: 'info'
});

// Listen for real-time events from Python agent
client.on('userInput', (event) => {
    // Handle events sent via swml_user_event() from Python
    console.log('Agent event:', event.detail);

    // event.detail = {
    //   type: 'item_added',
    //   item: { name: 'Pizza', price: 12.99 }
    // }
});

// Client is now ready to dial
```

### 2. **Dialing the Agent** (Browser)

```javascript
// In: /web/src/components/demo-ivr/AdvancedCallControls.jsx (startCall function)

const agentAddress = `/${subscriberId}/sally-agent`;
// Example: "/subscriber_1729377893_abc123/sally-agent"

const session = await client.dial({
    to: agentAddress,           // The address we created in SignalWire
    audio: true,                // Enable audio
    video: false,               // Disable video (voice-only)
    negotiateVideo: false,      // Don't negotiate video

    // Optional: Send context to agent
    userVariables: {
        interface: 'advanced-web-ui',
        sessionId: 'session_123',
        demoMode: true
    }
});

await session.start();  // Start the call
```

### 3. **What Happens When You Dial**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: Browser dials "/subscriber_1729377893_abc123/sally-agent"  │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 2: SignalWire Cloud looks up address in Fabric API            │
│                                                                     │
│ GET /api/fabric/subscribers/subscriber_1729377893_abc123/          │
│     addresses/sally-agent                                           │
│                                                                     │
│ Returns: {                                                          │
│   name: "sally-agent",                                             │
│   type: "swml",                                                     │
│   swml_url: "https://jonnykarate.ngrok.io/swml"                   │
│ }                                                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 3: SignalWire fetches SWML from Python backend                │
│                                                                     │
│ GET https://jonnykarate.ngrok.io/swml                              │
│                                                                     │
│ Python agent returns SWML document with:                            │
│ - AI personality/prompt                                             │
│ - Voice settings (voice: "nova.luna")                              │
│ - SWAIG function definitions                                        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 4: SignalWire processes call using SWML                       │
│                                                                     │
│ - Connects WebRTC audio stream to browser                          │
│ - Starts AI conversation with configured personality                │
│ - Converts speech → text (STT)                                      │
│ - AI processes text                                                 │
│ - Converts response → speech (TTS)                                  │
│ - Streams audio back to browser                                     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 5: User talks, AI calls functions                             │
│                                                                     │
│ User says: "I want to order a large pizza"                         │
│                                                                     │
│ AI decides to call: demo_order_item                                 │
│                                                                     │
│ SignalWire calls:                                                   │
│ POST https://jonnykarate.ngrok.io/swaig/demo_order_item            │
│ {                                                                   │
│   "argument": {                                                     │
│     "item_name": "large pizza",                                     │
│     "quantity": 1                                                   │
│   }                                                                 │
│ }                                                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 6: Python agent processes function call                       │
│                                                                     │
│ @AgentBase.tool(name="demo_order_item", ...)                       │
│ def demo_order_item(self, args, raw_data):                         │
│     item_name = args.get("item_name")                              │
│     quantity = args.get("quantity", 1)                             │
│                                                                     │
│     result = SwaigFunctionResult(                                  │
│         "I've added that to your order!"                           │
│     )                                                               │
│                                                                     │
│     # Send real-time event to browser                              │
│     result.swml_user_event({                                       │
│         "type": "item_added",                                      │
│         "item": {"name": item_name, "price": 12.99}                │
│     })                                                              │
│                                                                     │
│     return result                                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ Step 7: SignalWire forwards event to browser                       │
│                                                                     │
│ Browser's userInput event fires:                                    │
│                                                                     │
│ client.on('userInput', (event) => {                                │
│     // event.detail = {                                             │
│     //   type: 'item_added',                                        │
│     //   item: { name: 'large pizza', price: 12.99 }               │
│     // }                                                             │
│                                                                     │
│     updateCartUI(event.detail.item);  // Update React UI           │
│ });                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Files

### Where is the address name configured?

**File**: `/web/src/app/api/signalwire/generate-agent/route.js`

```javascript
const addressName = 'sally-agent';  // This is the address name

// Creates address in SignalWire:
POST /api/fabric/subscribers/{subscriberId}/addresses
{
  "name": "sally-agent",              // ← This is the address name
  "type": "swml",
  "swml_url": "https://jonnykarate.ngrok.io/swml"
}
```

### Where is the dial address used?

**File**: `/web/src/components/demo-ivr/AdvancedCallControls.jsx`

```javascript
const session = await client.dial({
    to: agentAddress,  // ← This comes from generate-agent API
    // agentAddress = "/subscriber_1729377893_abc123/sally-agent"
    audio: true,
    video: false
});
```

### How does the frontend get the address?

**File**: `/web/src/app/demo-ivr/page.jsx`

```javascript
// When user clicks "Generate Agent"
const response = await fetch("/api/signalwire/generate-agent", {
    method: "POST",
    body: JSON.stringify({ prompt, credentials, subscriberId })
});

const data = await response.json();

// data.callTo contains the address to dial
// Example: "/subscriber_1729377893_abc123/sally-agent"
setAgentAddress(data.callTo);

// Pass to AdvancedCallControls component
<AdvancedCallControls agentAddress={agentAddress} ... />
```

---

## SignalWire Client API

### Full Client Initialization

```javascript
import { SignalWire } from '@signalwire/js';

// 1. Get token from your backend
const tokenResponse = await fetch('/api/signalwire/webrtc-token', {
    method: 'POST',
    body: JSON.stringify({ credentials, subscriberId })
});
const { token } = await tokenResponse.json();

// 2. Initialize client
const client = await SignalWire({
    token: token,           // Fabric JWT token
    logLevel: 'info'        // or 'debug', 'warn', 'error'
});

// 3. Set up event listeners
client.on('userInput', (event) => {
    // Real-time events from agent
    console.log('Agent event:', event.detail);
});

client.on('session.updated', (session) => {
    console.log('Session updated:', session);
});

// 4. Dial the agent
const call = await client.dial({
    to: '/subscriber_123/sally-agent',  // Address format
    audio: true,
    video: false,
    userVariables: {
        customData: 'anything you want'
    }
});

// 5. Start the call
await call.start();

// 6. End the call
await call.hangup();
```

### Event Types from Python Agent

```javascript
client.on('userInput', (event) => {
    switch (event.detail.type) {
        case 'item_added':
            // User added item to cart
            console.log('Item added:', event.detail.item);
            break;

        case 'routing_decision':
            // Agent is routing to department
            console.log('Routing to:', event.detail.department);
            break;

        case 'status_checked':
            // Order status was checked
            console.log('Order status:', event.detail.order);
            break;

        case 'transfer_initiated':
            // Call is being transferred
            console.log('Transfer to:', event.detail.department);
            break;
    }
});
```

---

## Address Format Examples

SignalWire supports three address formats:

### 1. Public Address
```javascript
to: '/public/sally-agent'
// Anyone can dial this address
// No authentication required
```

### 2. Private Address
```javascript
to: '/private/sally-agent'
// Requires authentication
// Only subscribers with permission can dial
```

### 3. Subscriber Address (Our Implementation)
```javascript
to: '/subscriber_1729377893_abc123/sally-agent'
// Format: /{subscriberId}/{addressName}
// Scoped to specific subscriber
// Used by Sally Sales
```

---

## Key Files

| File | Purpose |
|------|---------|
| `/web/src/app/api/signalwire/generate-agent/route.js` | Creates subscriber and address in SignalWire |
| `/web/src/components/demo-ivr/AdvancedCallControls.jsx` | Handles SignalWire client connection and calling |
| `/web/src/app/demo-ivr/page.jsx` | Main UI, passes agent address to controls |
| `/agent/main.py` | Python backend that serves SWML and handles SWAIG functions |

---

## Summary

**Address Name**: `sally-agent` (configured in generate-agent/route.js)

**Full Dial Format**: `/{subscriberId}/sally-agent`

**SignalWire Client Code**:
```javascript
// Initialize
const client = await SignalWire({ token });

// Listen for events
client.on('userInput', handleAgentEvent);

// Dial
const call = await client.dial({
    to: `/${subscriberId}/sally-agent`,
    audio: true
});

await call.start();
```

**What gets dialed**: The subscriber address created in SignalWire Fabric API that points to `https://jonnykarate.ngrok.io/swml`

This architecture matches Holy Guacamole and all SignalWire documentation examples exactly!
