Create an image generation task for user approval. The task returns immediately with reserved image IDs; actual generation continues asynchronously after approval or auto-approval, and the app will notify you when the task reaches a terminal state.

Use short readable image_id values because they become future image references.

`n` means sampling multiple variants from the exact same prompt. It does not mean "put n images in one canvas", "make a collage", "generate a 2x2 grid", or generate several different photos.

If the user asks for multiple different photos, call GenImage independently multiple times instead of setting `n > 1`. Use `n > 1` only when you want multiple variants sampled from one unchanged prompt.

Available model IDs: {{models}}.

If you need another model, ask the user instead of inventing a model ID.

Do not include emoji characters in the `prompt` field unless the user has explicitly requested them.
