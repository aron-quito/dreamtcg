# Spell Speed Rules

When implementing new cards in the `src/engine/scripts` directory, follow these rules regarding effect activation timing and spell speeds. These map closely to traditional TCG rules.

## Spell Speed 1 (Ignition / Normal Effects)
- **Description:** These effects can only be manually activated by the turn player during their Main Phase. They do not chain to other effects.
- **Trigger Type:** Currently not explicitly separated in the enum, but traditionally maps to `ON_ACTIVATION` for Normal Spells or a custom trigger for Monster Ignition effects.
- **Implementation Note:** If a monster has an Ignition effect, consider checking `game.turnPlayerIndex === ctx.controllerIndex` before allowing activation, or adding a new `TriggerType.IGNITION`.

## Spell Speed 2 (Quick Effects / Fast Effects)
- **Description:** These effects can be activated during either player's turn, in response to an action or at any time priority is passed.
- **Trigger Type:** `TriggerType.ANY_TIME`
- **Implementation Note:** 
  - If a card text says "Any time:" or "During either player's turn:", use `TriggerType.ANY_TIME`.
  - The UI now provides an "ACTIVATE EFFECT" button on the field for these cards.

## Spell Speed 3 (Counter Effects)
- **Description:** Only Counter Trap cards have Spell Speed 3. They can only be responded to by other Spell Speed 3 effects.
- **Trigger Type:** `TriggerType.ON_ACTIVATION` (Specifically reacting to another activation).
- **Implementation Note:** When building chains in `engine.ts`, future updates will enforce speed limits (Speed 2 cannot chain to Speed 3).

## Engine Flow
1. Manual activations on the field trigger `engine.activateManualEffect()`.
2. This creates a `ChainLink` with the effect ID.
3. The engine currently resolves the chain immediately. In future architecture, it will pause, set `waitingForResponse = true`, and pass priority to the opponent before resolving.
