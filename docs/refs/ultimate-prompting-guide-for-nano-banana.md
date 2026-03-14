Product Marketing Manager, Gen Media

Technical Solutions Manager, Google Cloud

Creating precise, high-quality images often involves endless trial and error. You need a model that actually understands what you’re asking for.

Built on the Gemini 3 family of models, Nano Banana models apply deep reasoning capabilities to fully understand your prompt before generating an image. So we spent weeks testing Nano Banana 2 and Nano Banana Pro against every use case we could imagine to test its limits.

We put together this guide to share exactly what we learned and how you can get the best results.

**What you’ll learn in this guide:**

Model overview

Full breakdown of tech specs

Best practices for effective prompting

Prompting frameworks

How Nano Banana works with other creative models, Veo and Lyria.

Nano Banana models are advanced image generation and editing models that use real-world knowledge and deep reasoning capabilities to deliver precise, rich visual results. Most recently, [we announced Nano Banana 2](https://cloud.google.com/blog/products/ai-machine-learning/bringing-nano-banana-2-to-enterprise), which shines in three ways:

**More accurate visuals:** Nano Banana 2 is powered by real-time information and images from web search. This means better educational tools, localized marketing, travel apps, and more.

**Fast, Pro-level features:** We’ve unlocked premium features – from text rendering and translations, to upscaling to 2K/4K. Now, your creative teams can build cohesive narratives, storyboards, and product mockups.

**Precision control:** Generate or edit images to fit any project requirement, with native support for 16:9, 9:16, 2:1, and more. Expect vibrant lighting and richer textures, whether you’re generating posters, marketing mockups, or ads.

Before diving into prompting, here is a breakdown of what the models can handle via the API and Vertex AI (for latest details, always check the official [Gemini 3 Pro Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image) and [Gemini 3.1 Flash Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image) documentation):

**Context windows:** Gemini 3.1 Flash Image (Nano Banana 2) supports a maximum of 131,072 input tokens , while Gemini 3 Pro Image (Nano Banana Pro) supports a maximum of 65,536 input tokens. Both models support a maximum of 32,768 output tokens.

**Resolutions:** Built-in generation capabilities for 1K, 2K, and 4K visuals. Gemini 3.1 Flash Image adds the smaller 512px (0.5K) resolution.

**Aspect ratios:** Both models support 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, and 21:9. Gemini 3.1 Flash Image Preview also adds 1:4, 4:1, 1:8, and 8:1 aspect ratios.

**Image inputs:** You can mix up to 14 reference object images in a single prompt. Supported MIME types include image/png, image/jpeg, image/webp, image/heic, and image/heif.

**Document inputs:** You can input text and pdf files. The maximum file size per file is 50 MB for API and Cloud Storage imports, or 7 MB for direct uploads through the Google Cloud console.

**Outputs:** Both models output text and images.

**Model knowledge base:** Both models have a knowledge cutoff date of January 2025.

**Live data**: Both models are powered by real-time information from web search

**Trust & safety:** All generated images include [C2PA](https://c2pa.org/) Content Credentials and a SynthID watermark.

To see top features examples, [check out this blog](https://cloud.google.com/blog/products/ai-machine-learning/bringing-nano-banana-2-to-enterprise).

When it comes to effective prompting, there’s a few ways to ensure the visual you get is the visual you asked for. Here are some guidelines:

**Be specific:** Provide concrete details on subject, lighting, and composition.

**Use positive framing:** Describe what you want, not what you don’t want (e.g. “empty street” instead of “no cars”).

**Control the camera:** Use photographic and cinematic terms like “low angle” and “aerial view”.

**Iterate:** Refine images with follow-up prompts in a conversational manner.

The key is to start a prompt with a strong verb that tells the model the primary operation you want to perform.

When generating an image, your prompt structure depends entirely on whether you are using reference images or relying solely on text.

Text-to-image generation without references

When starting with a blank canvas, you are the director. A simple list of keywords won't cut it; you need to describe the scene narratively.

**Formula:** [Subject] + [Action] + [Location/context] + [Composition] + [Style]

**Example prompt:** [Subject] A striking fashion model wearing a tailored brown dress, sleek boots, and holding a structured handbag. [Action] Posing with a confident, statuesque stance, slightly turned. [Location/context] A seamless, deep cherry red studio backdrop. [Composition] Medium-full shot, center-framed. [Style] Fashion magazine style editorial, shot on medium-format analog film, pronounced grain, high saturation, cinematic lighting effect.

**Multimodal generation (generation ****with**** references)**

Gemini allows you to combine multiple reference images to guide the final output. This is perfect for maintaining character consistency or merging a specific product into a new environment.

**Formula:** [Reference images] + [Relationship instruction] + [New scenario]

**Example Prompt:** Using the attached napkin sketch as the structure and the attached fabric sample as the texture [References], transform this into a high-fidelity 3D armchair render [Relationship]. Place it in a sun-drenched, minimalist living room [New Scenario].

Note: Nano Banana generated the source images for the examples below, as well.

Editing requires a different mindset than generating. You already have a base image; your prompt needs to focus on what is changing and what is staying the same.

**Conversational editing (****without**** new references)**

When you generate an image and want to tweak it conversationally:

**Semantic masking (inpainting):** You can define a "mask" through text to edit a specific part of an image while leaving the rest untouched.

**Prompting tip:** Be explicit about what to keep exactly the same.**Example prompt:** “Remove the man from the photo”

**Composition and style transfer (****with**** new references)**

Bring new images into the prompt to alter an existing one:

**Adding elements:** Upload a base image and an object image, and tell the model to combine them.

**Style transfer:** Upload a photo and ask the model to recreate its exact content in a different artistic style, such as transforming a photo of a modern city street into a Van Gogh-style painting.

Composition

Style transfer

Gemini Image models can actively search the web to generate images based on real-time information.

**How prompting changes:** Instead of describing a fictional scene, you instruct the model to retrieve real-world data and then specify how to visualize it.

**The formula:** [Source/Search request] + [Analytical task] + [Visual translation]

**Example prompt:** [Search for current weather and date in San Francisco] + [Analytically, use this data to modify the scene (e.g., if raining, make it look grey and rainy)] + [Visualize this in a miniature city-in-a-cup concept embedded within a realistic, modern smartphone UI.

prompted on Tuesday 3rd March

Nano Banana 2 is powered by real-time information and images from web search. This feature is coming soon to Vertex AI, and will help your teams create more accurate visuals.

Nano Banana 2 and Nano Banana Pro excel at rendering sharp, legible text for impactful posters, diagrams, and product mockups. Furthermore, it supports state-of-the-art multilingual text generation in over 10 languages.

To get the best typographic results, follow these rules:

**Use quotes:** Enclose your desired words in quotes (e.g., "Happy Birthday" or "URBAN EXPLORER").

**Choose a font:** Describe the typography style or name of the font. Prompt for a "bold, white, sans-serif font" or "Century Gothic 12px font".

**Translate and localize:** Write your prompt in one language and specify a target language for the text output.

**Text-first hack:** When generating text for an image, Gemini Image models work best if you first converse with it to generate the text concepts, and then ask for an image with that text.

Example: A high-end, glossy commercial beauty shot of a sleek, minimalist nude-colored face moisturizer jar resting on a warm studio background. The lighting is soft and radiant. Next to the product, render three lines of text with the following exact styling: For the top line, the word 'GLOW' in a flowing, elegant Brush Script font. For the middle line, the text '10% OFF' in a heavy, blocky Impact font. For the bottom line, the text 'Your First Order' in a thin, minimalist Century Gothic font." Then translate the text into Korean and Arabic.

“A typographic poster with a solid black background, bold letters spell "New York", filling the center of the frame. The text acts as a cut-out window. A photograph of New York skyline is visible ONLY inside the letterforms.”

To elevate your results from good to breathtaking, you need to stop typing keywords and start directing the scene. The Gemini image models offer studio-quality controls. Here is how to prompt like a Creative Director:

**1. Design your lighting **

Tell the model exactly how the scene is illuminated.

Studio setups: Ask for a "three-point softbox setup" to evenly light a product.

**2. Choose your camera, lens, and focus**

Use specific hardware and photographic terminology to control the depth, distortion, and perspective of your shot .

Hardware: Dictate the exact camera type to change the visual DNA of the image. Ask for the shot to be taken on a **GoPro** for an immersive, distorted action feel, a **Fujifilm** camera for authentic color science, or a cheap **disposable camera** for a raw, nostalgic flash aesthetic.

**3. Define the color grading and film stock**

The texture and color of the final image set the emotional tone.

If you want a nostalgic or gritty vibe, tell the model to render the image "as if on 1980s color film, slightly grainy".

For a modern, moody aesthetic, ask for "Cinematic color grading with muted teal tones".

**4. Emphasize materiality and texture**

When generating logos, products, or characters, define their physical makeup. Don't just ask for a suit jacket; ask for "navy blue tweed". Instead of "armor," describe "ornate elven plate armor, etched with silver leaf patterns." If you are designing a mockup, specify the surface, like a "minimalist ceramic coffee mug."

Nano Banana Pro and Nano Banana 2 are designed to work seamlessly with our other generative creation models.