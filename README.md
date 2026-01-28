# CFX Events Navigation

Navigate FiveM/RedM events like regular functions. **Ctrl+Click** on any event string to see all handlers and triggers in a peek view.

## Features

- **Go to Definition** — Ctrl+Click on event names to see all locations
- **Peek View** — Shows all handlers (RegisterNetEvent/AddEventHandler) and triggers (TriggerEvent/TriggerServerEvent/etc.)
- **Hover Info** — Shows handler and trigger count
- **Find All References** — Shift+F12 to find all usages
- **Auto-indexing** — Automatically updates when you save Lua files

## Supported Patterns

**Handlers (definitions):**
- `RegisterNetEvent('eventName', ...)`
- `AddEventHandler('eventName', ...)`

**Triggers (references):**
- `TriggerEvent('eventName', ...)`
- `TriggerServerEvent('eventName', ...)`
- `TriggerClientEvent('eventName', ...)`
- `TriggerLatentServerEvent('eventName', ...)`
- `TriggerLatentClientEvent('eventName', ...)`

## Usage

1. Open any Lua file in your FiveM/RedM resource
2. **Ctrl+Click** on an event name (inside quotes) to see all locations
3. **Hover** over an event to see handler/trigger count
4. **Shift+F12** to find all references

## Commands

- `CFX Events: Reindex Events` — Manually rebuild the event index

## Example

```lua
-- Handler (definition)
RegisterNetEvent('myResource:doSomething', function(data)
    print('Received:', data)
end)

-- Trigger (reference)
TriggerServerEvent('myResource:doSomething', { foo = 'bar' })
```

Ctrl+Click on `'myResource:doSomething'` in either location to see both the handler and all triggers.

## License

MIT