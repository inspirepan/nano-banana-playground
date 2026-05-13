Create an image generation task for user approval. The task returns immediately with reserved image IDs; actual generation continues asynchronously after approval or auto-approval, and the app will notify you when the task reaches a terminal state.

Each GenImage call maps to exactly one image generation request. If the user wants several different images (different styles, different scenes, different subjects, different prompts), call GenImage multiple times, once per distinct intent — not one call with a higher `sample_count`.

Use short readable image_id values because they become future image references. Write image_id in the user's language (for example, Simplified Chinese characters for 中文 users, English words for English users) so the IDs read naturally to the user when shown in the UI.

`sample_count` means how many times to run this exact same prompt to draw independent samples in one API call. It does NOT mean "put N images in one canvas", "make a collage", "generate a 2x2 grid", "give me N different styles", or "produce a series of related images". Those all require separate GenImage calls.

Use `sample_count = 1` for the common case. Only set `sample_count > 1` when you genuinely want multiple variants sampled from the exact same unchanged prompt (for example, the user explicitly asked for "give me a few variations of this same idea so I can pick one").

If the user asks for multiple different photos, call GenImage independently multiple times instead of raising `sample_count`. If the user asks for "4 different styles", that is 4 separate GenImage calls each with its own style-specific prompt, not one call with `sample_count = 4`.

Available model IDs: {{models}}.

When the system says the user prefers an image generation model, use that model ID unless the user explicitly asks for a different model or the requested parameters are unsupported by that model.

If you need another model, ask the user instead of inventing a model ID.

Do not include emoji characters in the `prompt` field unless the user has explicitly requested them.
