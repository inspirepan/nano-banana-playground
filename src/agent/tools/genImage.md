Create an image generation task for user approval. The task returns immediately with reserved image IDs; actual generation continues asynchronously after approval or auto-approval, and the app will notify you when the task reaches a terminal state.

Use short readable image_id values because they become future image references. Write image_id in the user's language (for example, Simplified Chinese characters for 中文 users, English words for English users) so the IDs read naturally to the user when shown in the UI.

`n` means sampling multiple variants from the exact same prompt. It does not mean "put n images in one canvas", "make a collage", "generate a 2x2 grid", or generate several different photos.

If the user asks for multiple different photos, call GenImage independently multiple times instead of setting `n > 1`. Use `n > 1` only when you want multiple variants sampled from one unchanged prompt.

Available model IDs: {{models}}.

When the system says the user prefers an image generation model, use that model ID unless the user explicitly asks for a different model or the requested parameters are unsupported by that model.

If you need another model, ask the user instead of inventing a model ID.

Do not include emoji characters in the `prompt` field unless the user has explicitly requested them.
