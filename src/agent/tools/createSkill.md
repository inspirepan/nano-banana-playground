Create or update a user skill in the browser's virtual skill library.

Use this tool when the user asks to create a skill, save a reusable workflow, remember instructions as a skill, or when a conversation has produced stable guidance worth turning into a reusable skill and the user agrees.

Rules:

- Create concise text-only skills. The browser cannot run bundled scripts or read arbitrary local files.
- Use lowercase kebab-case names.
- Include a useful `agent_description`; it is the discovery text shown to the model before loading the skill.
- Include localized one-line display descriptions for the settings UI.
- Choose a Lucide `icon` name in kebab-case, such as `image`, `pencil-ruler`, `paintbrush`, `book-open`, or `sparkles`.
- Include `SKILL.md` when possible. Additional markdown files may live under nested paths like `references/palettes/warm.md`.
- Do not overwrite built-in system skills.
- Do not create a skill for one-off, ephemeral facts. Skills should encode reusable procedures or domain guidance.
