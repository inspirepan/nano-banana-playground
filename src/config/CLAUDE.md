# Config package notes

## Adding an image generation model

Image generation models are configuration driven, but adding a new provider still touches several layers. For a model like Doubao Seedream, update these places together:

- `src/config/models.ts`: add the `ModelConfig` variant if the provider is new, add the model entry in `MODEL_CONFIGS`, and keep supported resolutions / aspect ratios / batch and reference-image limits accurate.
- `src/config/providers.ts`: add the provider id, labels, storage keys, default Base URL, and brand icon name.
- `src/lib/imageApi/`: add a provider request adapter when the wire format is not already covered by Google or OpenAI, then route it from `src/lib/api.ts`. If the provider uses symbolic resolutions such as `2K` / `3K`, keep the adapter's size mapping in sync with `MODEL_CONFIGS`.
- `src/lib/validateKey.ts`: normalize the provider Base URL, preview the real endpoint, validate the key with a cheap request, and keep proxy Base URL handling compatible with both absolute URLs and `/api/llm/...` relative paths.
- `functions/api/_proxy.ts`: add the provider target for Cloudflare Pages Functions. If the provider target includes a path such as `/api/v3`, make sure catch-all path segments append after that path.
- `vite.config.ts`: mirror the provider target in the local dev proxy. The Vite middleware has its own provider map; forgetting it makes `/api/llm/{provider}/...` return local 404 even when production proxy config is correct.
- `src/components/Icon.tsx`: add the provider brand icon if it is new.
- `src/i18n/messages/apiKeys.ts`: add service-connection labels, placeholders, and hints for the API key dialog.
- `src/lib/pricing.ts`: return known pricing or `null` for unknown estimates/costs so the UI does not accidentally apply another provider's pricing model.

Agent image generation uses the same `MODEL_CONFIGS` list:

- `src/agent/tools/genImage.md` and `src/agent/tools/genImage.ts` expose available image model IDs to the LLM through the `GenImage` tool.
- `src/components/agent-chat/AgentOptionsMenu.tsx` renders the preferred image model selector from `MODEL_CONFIGS`; it should surface missing provider keys and open the API key settings when needed.
- `src/config/preferredImageModel.ts` validates saved preferred image model ids against `MODEL_CONFIGS`, so new models become selectable automatically.
- `src/agent/useAgentImageTools.ts` resolves the requested model via `findModelConfig`, fetches credentials with `getProviderCredentials(modelConfig.provider)`, and enqueues the normal generation job. New image providers should therefore work here as long as the main generation adapter and provider credentials are wired correctly.

For provider-specific Base URLs, test both direct and proxied forms:

- Direct: `https://provider.example.com/...`
- Local proxy: `http://localhost:5173/api/llm/{provider}/...`
- Custom proxied Base URL: `/api/llm/{base64url-custom-target}/...`

When validating a new image provider, prefer non-generation probes first to avoid accidental charges. For Doubao/Ark, `GET /api/v3/models` verifies the key, while `POST /api/v3/images/generations` with an intentionally incomplete body verifies that the image endpoint and model route exist without generating an image.
