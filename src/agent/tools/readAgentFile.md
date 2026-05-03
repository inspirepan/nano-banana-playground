Read a browser-side virtual Agent file.

Use this when a previous tool result says the full output was saved to an `agent://...` path. These files are stored in the current Agent session, not on the user's local filesystem.

Parameters:

- `path`: The exact `agent://...` path shown by the previous tool result.
- `offset`: Optional 1-indexed line number to start reading from. Omit it for the beginning of the file.
- `limit`: Optional number of lines to read. Defaults to 2000.

The output is line-numbered. For long files, continue by calling this tool again with a larger `offset`.
