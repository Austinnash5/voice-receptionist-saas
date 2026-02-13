# Call Flow Builder Guide

## Overview

The Call Flow system allows you to create multi-step Interactive Voice Response (IVR) menus and call routing logic. Flows are stored in the `CallFlow` table with a JSON configuration.

## Flow Types

- **MAIN_MENU** - Initial greeting and menu when someone calls
- **AFTER_HOURS** - Played when business is closed
- **NO_ANSWER** - Played when a transfer isn't answered
- **VOICEMAIL** - Direct voicemail collection
- **DEPARTMENT** - Department-specific menus (Sales, Service, etc.)
- **CUSTOM** - Custom flows for special cases

## Flow Configuration Structure

Each flow has a JSON configuration with this structure:

```json
{
  "steps": [
    {
      "id": "unique-step-id",
      "type": "menu|message|transfer|ai|voicemail|conditional|gather_info",
      // Step-specific properties...
    }
  ],
  "entryPoint": "step-id-to-start-with",
  "description": "Optional description"
}
```

## Step Types

### 1. Menu Step
Interactive menu with digit options:

```json
{
  "id": "main_menu",
  "type": "menu",
  "prompt": "Welcome to Preferred Trailers. Press 1 for Texas location, press 2 for Arizona location.",
  "timeout": 5,
  "options": [
    {
      "digit": "1",
      "label": "Texas Location",
      "action": "goto",
      "target": "texas_menu"
    },
    {
      "digit": "2",
      "label": "Arizona Location",
      "action": "transfer",
      "phoneNumber": "+14805551234"
    }
  ]
}
```

**Actions**:
- `goto` - Navigate to another step (requires `target`)
- `transfer` - Transfer to phone number (requires `phoneNumber`)
- `ai` - Hand off to AI receptionist
- `voicemail` - Send to voicemail
- `hangup` - End the call

### 2. Message Step
Play a message and move to next step:

```json
{
  "id": "closed_message",
  "type": "message",
  "prompt": "We are currently closed. Our office hours are Monday through Friday, 9 AM to 5 PM.",
  "nextStep": "voicemail_prompt"
}
```

### 3. Transfer Step
Transfer to a phone number:

```json
{
  "id": "transfer_sales",
  "type": "transfer",
  "prompt": "Transferring you to our sales team. Please hold.",
  "phoneNumber": "+15555551234"
}
```

### 4. AI Step
Hand off to AI receptionist:

```json
{
  "id": "ai_receptionist",
  "type": "ai",
  "prompt": "You're now speaking with our AI assistant. How can I help you today?"
}
```

### 5. Voicemail Step
Collect voicemail:

```json
{
  "id": "leave_voicemail",
  "type": "voicemail",
  "prompt": "Please leave a detailed message after the beep, and we'll call you back as soon as possible."
}
```

### 6. Conditional Step
Branch based on conditions:

```json
{
  "id": "check_hours",
  "type": "conditional",
  "condition": "is_open",
  "trueTarget": "open_menu",
  "falseTarget": "closed_message"
}
```

**Conditions**:
- `is_open` - Business is currently open
- `is_closed` - Business is currently closed

### 7. Gather Info Step
Collect information from caller:

```json
{
  "id": "get_name",
  "type": "gather_info",
  "prompt": "What is your name?",
  "gatherType": "name",
  "nextStep": "get_phone"
}
```

## Complete Example Flows

### Example 1: Simple Location Selection

```json
{
  "entryPoint": "welcome",
  "description": "Main menu with location selection",
  "steps": [
    {
      "id": "welcome",
      "type": "menu",
      "prompt": "Welcome to Preferred Trailers. This call may be recorded for quality assurance. Press 1 for our Texas location, press 2 for our Arizona location, or press 0 to speak with someone.",
      "timeout": 5,
      "options": [
        {
          "digit": "1",
          "label": "Texas Location",
          "action": "goto",
          "target": "texas_submenu"
        },
        {
          "digit": "2",
          "label": "Arizona Location",
          "action": "goto",
          "target": "az_submenu"
        },
        {
          "digit": "0",
          "label": "Operator",
          "action": "ai",
          "target": null
        }
      ]
    },
    {
      "id": "texas_submenu",
      "type": "menu",
      "prompt": "Texas location. Press 1 for sales, press 2 for service, press 3 for directions and hours.",
      "timeout": 5,
      "options": [
        {
          "digit": "1",
          "label": "Sales",
          "action": "transfer",
          "phoneNumber": "+14695551000"
        },
        {
          "digit": "2",
          "label": "Service",
          "action": "transfer",
          "phoneNumber": "+14695551001"
        },
        {
          "digit": "3",
          "label": "Info",
          "action": "ai",
          "target": null
        }
      ]
    },
    {
      "id": "az_submenu",
      "type": "menu",
      "prompt": "Arizona location. Press 1 for sales, press 2 for service, press 3 for directions and hours.",
      "timeout": 5,
      "options": [
        {
          "digit": "1",
          "label": "Sales",
          "action": "transfer",
          "phoneNumber": "+14805551000"
        },
        {
          "digit": "2",
          "label": "Service",
          "action": "transfer",
          "phoneNumber": "+14805551001"
        },
        {
          "digit": "3",
          "label": "Info",
          "action": "ai",
          "target": null
        }
      ]
    }
  ]
}
```

### Example 2: After Hours Flow with Business Hours Check

```json
{
  "entryPoint": "check_hours",
  "description": "Check business hours and route accordingly",
  "steps": [
    {
      "id": "check_hours",
      "type": "conditional",
      "condition": "is_open",
      "trueTarget": "open_greeting",
      "falseTarget": "closed_message"
    },
    {
      "id": "open_greeting",
      "type": "menu",
      "prompt": "Thank you for calling. We're currently open. Press 1 for sales, press 2 for service, or press 0 to speak with someone.",
      "timeout": 5,
      "options": [
        {
          "digit": "1",
          "label": "Sales",
          "action": "ai",
          "target": null
        },
        {
          "digit": "2",
          "label": "Service",
          "action": "ai",
          "target": null
        },
        {
          "digit": "0",
          "label": "Operator",
          "action": "transfer",
          "phoneNumber": "+15555550100"
        }
      ]
    },
    {
      "id": "closed_message",
      "type": "message",
      "prompt": "Thank you for calling. We are currently closed. Our business hours are Monday through Friday, 8 AM to 6 PM, and Saturday 9 AM to 3 PM.",
      "nextStep": "voicemail_offer"
    },
    {
      "id": "voicemail_offer",
      "type": "voicemail",
      "prompt": "Please leave a message with your name, phone number, and reason for calling. Someone will get back to you during our next business day."
    }
  ]
}
```

### Example 3: No Answer Flow

```json
{
  "entryPoint": "no_answer_message",
  "description": "Played when transfer isn't answered",
  "steps": [
    {
      "id": "no_answer_message",
      "type": "message",
      "prompt": "I'm sorry, but no one is available to take your call right now.",
      "nextStep": "capture_callback"
    },
    {
      "id": "capture_callback",
      "type": "voicemail",
      "prompt": "Please leave your name, phone number, and a brief message. We'll call you back as soon as possible."
    }
  ]
}
```

## Creating Flows via SQL

Until the UI is complete, you can create flows directly in the database:

```sql
-- Example: Create a main menu flow for a tenant
INSERT INTO "CallFlow" (id, "tenantId", name, "flowType", "isActive", priority, config)
VALUES (
  gen_random_uuid(),
  'your-tenant-id-here',
  'Main Business Menu',
  'MAIN_MENU',
  true,
  1,
  '{
    "entryPoint": "welcome",
    "description": "Main menu with location selection",
    "steps": [
      {
        "id": "welcome",
        "type": "menu",
        "prompt": "Welcome to Preferred Trailers. Press 1 for Texas, press 2 for Arizona.",
        "timeout": 5,
        "options": [
          {"digit": "1", "label": "Texas", "action": "ai", "target": null},
          {"digit": "2", "label": "Arizona", "action": "ai", "target": null}
        ]
      }
    ]
  }'::jsonb
);
```

## Testing Your Flows

1. Deploy the updated code to your VPS
2. Run `npx prisma db push` to update the database schema
3. Create a flow using SQL (as shown above)
4. Call your Twilio number
5. The system will automatically use the active flow with the highest priority

## Flow Priority

If multiple flows of the same type exist:
- Higher `priority` value = used first
- Only `isActive = true` flows are used
- If no flow exists for a type, it falls back to simple AI greeting

## Next Steps

A visual Flow Builder UI is in development that will allow you to:
- Drag-and-drop flow steps
- Visual connection between steps
- Test flows before activation
- Clone and edit existing flows
- Preview the caller experience

Stay tuned for the UI release!
