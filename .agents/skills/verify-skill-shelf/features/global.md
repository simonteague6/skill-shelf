# Global collection

## Sub-features

- Separate global inventory and metadata.
- Tab from overview or details; per-scope selection survives switching.
- Global path overrides and empty Global state.

## How to get to it (user POV)

Launch the app and press Tab. Enter inspects a global skill. Tab returns to
Project, including while details are open.

## Driving it with verify.py

Run journey `global`. From the five-skill Project overview, Tab must produce
`Global · 1 installed` and `global-only`. Enter must show that skill's installed
locations with `Agents`. Tab from details must return to the five-skill Project
overview with alpha. Capture the action events and unchanged fixture inventories.

## Gotchas

The fake home contains only one global skill. This proves scope separation, not
selection memory for multiple global skills, lock attribution variants, empty
Global, or all upstream override variables. Add explicit seeds for those cases.
All host environment overrides are excluded from the subprocess.
