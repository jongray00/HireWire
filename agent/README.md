# Sally Sales Agent Backend

Python backend for the Sally Sales AI agent using SignalWire Agents SDK.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the agent:
```bash
python main.py
```

The agent will be available at `http://localhost:3030`

## Exposing with ngrok

To make the agent accessible to SignalWire:

```bash
ngrok http 3030 --domain=jonnykarate.ngrok.io
```

The agent SWML endpoint will be at: `https://jonnykarate.ngrok.io/swml`

## API Endpoints

- `GET /swml` - SWML document (called by SignalWire)
- `POST /swaig/{function}` - SWAIG function handlers (called by SignalWire)
- `POST /api/update-config` - Update agent configuration from UI
- `GET /api/config` - Get current agent configuration
- `GET /health` - Health check

## Configuration

The agent can be dynamically configured from the web UI. When you update the prompt in the UI, it sends a request to `/api/update-config` which updates the agent's personality and behavior in real-time.

## Functions

The agent includes these SWAIG functions:

- `route_to_order` - Route to order department
- `route_to_schedule` - Route to scheduling/appointments
- `route_to_support` - Route to customer support
- `demo_order_item` - Add items to order (demo)
- `demo_get_status` - Check order status (demo)
- `transfer_call` - Transfer to human representative

## Real-Time Events

The agent sends real-time events to the UI via `swml_user_event()`:

- `routing_decision` - When routing to a department
- `item_added` - When an item is added to order
- `status_checked` - When order status is checked
- `transfer_initiated` - When call transfer is initiated

These events are received in the browser via the SignalWire client's `userInput` event listener.
