<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:telegram-transfer-rules -->
# Telegram transfer behavior rules

- `captioned_only` is an album strategy only. It must only affect message selection within Telegram albums/media groups.
- `captioned_only` must not change handling for non-album messages. Single/non-grouped messages should be processed normally regardless of whether they have captions.
<!-- END:telegram-transfer-rules -->
