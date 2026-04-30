Create an image generation task for user approval. The task returns immediately with reserved image IDs; actual generation continues asynchronously after approval or auto-approval, and the app will notify you when the task reaches a terminal state.

Use short readable image_id values because they become future image references.

Available model IDs: {{models}}.

If you need another model, ask the user instead of inventing a model ID.
