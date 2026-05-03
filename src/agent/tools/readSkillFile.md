Read a markdown file from a loaded skill package.

Use this tool for progressive disclosure after `Skill` returns a virtual file list and the task needs a referenced file.

Rules:

- `skill` must be an enabled skill name.
- `path` must be a relative path inside that skill package, such as `references/palettes/warm.md`.
- `offset` is an optional 1-indexed line number. Omit it for the beginning of the file.
- `limit` is an optional number of lines to read. Defaults to 2000.
- Do not use absolute paths, `../`, or paths not shown in the skill file list.
- This is not a general filesystem reader; it can only read virtual skill markdown files.
- The output is line-numbered and uses the same truncation rules as `ReadAgentFile`; continue with a larger `offset` when the result says more lines were truncated.
