Load a skill's main instructions into the conversation.

Use this tool before acting when a listed skill matches the user's request, or when the user explicitly references `//skill:name`, `/name`, or a skill name.

Rules:

- The input is a skill name, with or without a leading slash.
- This tool returns the skill's `SKILL.md` body plus a virtual file list.
- Follow the loaded instructions directly after the tool result.
- If the loaded skill points to additional markdown files, call `ReadSkillFile` only for the files needed for the current task.
- Do not call this tool for a skill that is already loaded in the current turn.
