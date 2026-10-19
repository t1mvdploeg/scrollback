---
id: a-command-menu-that-listens
url: https://example.invalid/reel/a-command-menu-that-listens/
collection: Build
maker: Small Signal Workshop
type: video
tags: accessibility, keyboard, interface, javascript
---
# Build a command menu that respects the keyboard

## What is explained
- Open the menu from a button as well as the keyboard shortcut.
- Move focus into the dialog, filter commands as the user types and return focus to the trigger on close.
- The example shows an empty state and a reduced-motion preference; no full source download is provided.

## Tools, repos and links mentioned
- HTML dialog: The native dialog element appears in the code sample. (on screen)
- JavaScript: A small event handler filters the command list. (on screen)

## Design
- Colours: Deep blue-gray #1B2431, pale text #F0F3F7 and muted blue #7397CF; dark mode.
- Type: Compact neutral sans, with monospace keyboard hints.
- Layout: A centered dialog over a quiet sidebar app, grouped command rows and even 16px spacing.
- Effects: A brief opacity transition; movement is removed with reduced motion.
- Looks like: Nothing specific
- Libraries: CSS Grid (on screen)

## Core claim
A small native command menu can be useful without becoming a new dependency.

## Usefulness
The keyboard behavior is demonstrated rather than merely promised. The fragment still needs an accessibility review in a real app, especially for filtered results. No paid product is promoted, and none of the code has been run here.
