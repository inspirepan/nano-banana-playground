# Nano Banana 图片生成

[试用 Nano Banana 2 应用](https://aistudio.google.com/apps/bundled/pet_passport?hl=zh-cn)- 或者，您也可以根据提示自行构建：

-

由 Nano Banana 2 生成 -

由 Nano Banana Pro 生成 -

由 Nano Banana 2 生成 -

由 Nano Banana Pro 生成 -

由 Nano Banana Pro 生成 -

由 Nano Banana Pro 生成 -

由 Nano Banana Pro 生成 **提示**：“一个代表可爱狗狗的图标。背景为白色。以色彩鲜艳且具有触感的 3D 风格制作图标。没有文字。"在[AI Studio](https://aistudio.google.com/apps?features=chat_based_image_editing%2Csearch_grounding&hl=zh-cn)中使用 Nano Banana 创建[图标、贴纸和素材资源](#2_stylized_illustrations_stickers) -

由 Nano Banana 2 生成

**Nano Banana** 是 Gemini 原生图片生成功能的名称。
Gemini 可以通过文本、图片或两者结合的方式生成和处理图片。这样一来，您就可以以前所未有的掌控力来创建、修改和迭代视觉效果。

Nano Banana 是指 Gemini API 中提供的两种不同的模型：

**Nano Banana 2**：[Gemini 3.1 Flash Image（预览版）](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview?hl=zh-cn)模型 (`gemini-3.1-flash-image-preview`

)。此模型是 Gemini 3 Pro Image 的高效版本，针对速度和高用量开发者使用情形进行了优化。**Nano Banana Pro**：[Gemini 3 Pro Image 预览版](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview?hl=zh-cn)模型 (`gemini-3-pro-image-preview`

)。此模型专为专业资产制作而设计，利用高级推理（“思考”）功能来遵循复杂的指令并呈现高保真文本。**Nano Banana**：[Gemini 2.5 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image?hl=zh-cn)模型 (`gemini-2.5-flash-image`

)。此模型专为速度和效率而设计，经过优化，可处理海量低延迟任务。

所有生成的图片都包含 [SynthID 水印](https://ai.google.dev/responsible/docs/safeguards/synthid?hl=zh-cn)。

## 图片生成（文生图）

### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
prompt = ("Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme")
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[prompt],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("generated_image.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("gemini-native-image.png", buffer);
console.log("Image saved as gemini-native-image.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("Create a picture of a nano banana dish in a " +
" fancy restaurant with a Gemini theme"),
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "gemini_generated_image.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class TextToImage {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("_01_generated_image.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
]
}]
}'
```


## 图片编辑（文本和图片转图片）

**提醒**：请确保您对上传的所有图片均拥有必要权利。
请勿生成会侵犯他人权利的内容，包括会欺骗、骚扰或伤害他人的视频或图片。使用此生成式 AI 服务时须遵守我们的[《使用限制政策》](https://policies.google.com/terms/generative-ai/use-policy?hl=zh-cn)。

提供图片，然后使用文本提示添加、移除或修改元素、更改样式或调整色彩分级。

以下示例演示了如何上传 `base64`

编码的图片。
如需了解多张图片、更大的载荷和支持的 MIME 类型，请参阅[图片理解](https://ai.google.dev/gemini-api/docs/image-understanding?hl=zh-cn)页面。

### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
prompt = (
"Create a picture of my cat eating a nano-banana in a "
"fancy restaurant under the Gemini constellation",
)
image = Image.open("/path/to/cat_image.png")
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[prompt, image],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("generated_image.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "path/to/cat_image.png";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{ text: "Create a picture of my cat eating a nano-banana in a" +
"fancy restaurant under the Gemini constellation" },
{
inlineData: {
mimeType: "image/png",
data: base64Image,
},
},
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("gemini-native-image.png", buffer);
console.log("Image saved as gemini-native-image.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/cat_image.png"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
genai.NewPartFromText("Create a picture of my cat eating a nano-banana in a fancy restaurant under the Gemini constellation"),
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData,
},
},
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "gemini_generated_image.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class TextAndImageToImage {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromText("""
Create a picture of my cat eating a nano-banana in
a fancy restaurant under the Gemini constellation
"""),
Part.fromBytes(
Files.readAllBytes(
Path.of("src/main/resources/cat.jpg")),
"image/jpeg")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("gemini_generated_image.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{\"text\": \"'Create a picture of my cat eating a nano-banana in a fancy restaurant under the Gemini constellation\"},
{
\"inline_data\": {
\"mime_type\":\"image/jpeg\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
}
]
}]
}"
```


### 多轮图片修改

继续以对话方式生成和修改图片。建议使用聊天或多轮对话的方式来迭代图片。以下示例展示了生成有关光合作用的信息图表的提示。

### Python

```
from google import genai
from google.genai import types
client = genai.Client()
chat = client.chats.create(
model="gemini-3.1-flash-image-preview",
config=types.GenerateContentConfig(
response_modalities=['TEXT', 'IMAGE'],
tools=[{"google_search": {}}]
)
)
message = "Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plant's favorite food. Show the \"ingredients\" (sunlight, water, CO2) and the \"finished dish\" (sugar/energy). The style should be like a page from a colorful kids' cookbook, suitable for a 4th grader."
response = chat.send_message(message)
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("photosynthesis.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
async function main() {
const chat = ai.chats.create({
model: "gemini-3.1-flash-image-preview",
config: {
responseModalities: ['TEXT', 'IMAGE'],
tools: [{googleSearch: {}}],
},
});
}
await main();
const message = "Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plant's favorite food. Show the \"ingredients\" (sunlight, water, CO2) and the \"finished dish\" (sugar/energy). The style should be like a page from a colorful kids' cookbook, suitable for a 4th grader."
let response = await chat.sendMessage({message});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("photosynthesis.png", buffer);
console.log("Image saved as photosynthesis.png");
}
}
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Text, genai.Image},
}
chat := model.StartChat()
message := "Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plant's favorite food. Show the \"ingredients\" (sunlight, water, CO2) and the \"finished dish\" (sugar/energy). The style should be like a page from a colorful kids' cookbook, suitable for a 4th grader."
resp, err := chat.SendMessage(ctx, genai.Text(message))
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("photosynthesis.png", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
}
```


### Java

```
import com.google.genai.Chat;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.GoogleSearch;
import com.google.genai.types.ImageConfig;
import com.google.genai.types.Part;
import com.google.genai.types.RetrievalConfig;
import com.google.genai.types.Tool;
import com.google.genai.types.ToolConfig;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class MultiturnImageEditing {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.tools(Tool.builder()
.googleSearch(GoogleSearch.builder().build())
.build())
.build();
Chat chat = client.chats.create("gemini-3.1-flash-image-preview", config);
GenerateContentResponse response = chat.sendMessage("""
Create a vibrant infographic that explains photosynthesis
as if it were a recipe for a plant's favorite food.
Show the "ingredients" (sunlight, water, CO2)
and the "finished dish" (sugar/energy).
The style should be like a page from a colorful
kids' cookbook, suitable for a 4th grader.
""");
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("photosynthesis.png"), blob.data().get());
}
}
}
// ...
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"role": "user",
"parts": [
{"text": "Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plants favorite food. Show the \"ingredients\" (sunlight, water, CO2) and the \"finished dish\" (sugar/energy). The style should be like a page from a colorful kids cookbook, suitable for a 4th grader."}
]
}],
"generationConfig": {
"responseModalities": ["TEXT", "IMAGE"]
}
}'
```


![关于光合作用的 AI 生成的信息图](https://ai.google.dev/static/gemini-api/docs/images/infographic-eng.png?hl=zh-cn)

然后，您可以使用同一对话将图片中的文字更改为西班牙语。

### Python

```
message = "Update this infographic to be in Spanish. Do not change any other elements of the image."
aspect_ratio = "16:9" # "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
resolution = "2K" # "512", "1K", "2K", "4K"
response = chat.send_message(message,
config=types.GenerateContentConfig(
image_config=types.ImageConfig(
aspect_ratio=aspect_ratio,
image_size=resolution
),
))
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("photosynthesis_spanish.png")
```


### JavaScript

```
const message = 'Update this infographic to be in Spanish. Do not change any other elements of the image.';
const aspectRatio = '16:9';
const resolution = '2K';
let response = await chat.sendMessage({
message,
config: {
responseModalities: ['TEXT', 'IMAGE'],
imageConfig: {
aspectRatio: aspectRatio,
imageSize: resolution,
},
tools: [{googleSearch: {}}],
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("photosynthesis2.png", buffer);
console.log("Image saved as photosynthesis2.png");
}
}
```


### Go

```
message = "Update this infographic to be in Spanish. Do not change any other elements of the image."
aspect_ratio = "16:9" // "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
resolution = "2K" // "512", "1K", "2K", "4K"
model.GenerationConfig.ImageConfig = &pb.ImageConfig{
AspectRatio: aspect_ratio,
ImageSize: resolution,
}
resp, err = chat.SendMessage(ctx, genai.Text(message))
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("photosynthesis_spanish.png", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
```


### Java

```
String aspectRatio = "16:9"; // "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
String resolution = "2K"; // "512", "1K", "2K", "4K"
config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio(aspectRatio)
.imageSize(resolution)
.build())
.build();
response = chat.sendMessage(
"Update this infographic to be in Spanish. " +
"Do not change any other elements of the image.",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("photosynthesis_spanish.png"), blob.data().get());
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
"contents": [
{
"role": "user",
"parts": [{"text": "Create a vibrant infographic that explains photosynthesis..."}]
},
{
"role": "model",
"parts": [{"inline_data": {"mime_type": "image/png", "data": "<PREVIOUS_IMAGE_DATA>"}}]
},
{
"role": "user",
"parts": [{"text": "Update this infographic to be in Spanish. Do not change any other elements of the image."}]
}
],
"tools": [{"google_search": {}}],
"generationConfig": {
"responseModalities": ["TEXT", "IMAGE"],
"imageConfig": {
"aspectRatio": "16:9",
"imageSize": "2K"
}
}
}'
```


![AI 生成的西班牙语光合作用信息图](https://ai.google.dev/static/gemini-api/docs/images/infographic-spanish.png?hl=zh-cn)

## 全新 Gemini 3 图片模型

Gemini 3 提供先进的图片生成和编辑模型。Gemini 3.1 Flash Image 针对速度和大规模使用场景进行了优化，而 Gemini 3 Pro Image 针对专业素材制作进行了优化。 这些模型旨在通过高级推理来应对最具挑战性的工作流程，擅长处理复杂的多轮创建和修改任务。

**高分辨率输出**：内置 1K、2K 和 4K 视觉效果生成功能。**Gemini 3.1 Flash Image**新增了较小的 512（0.5K）分辨率。

**高级文本渲染**：能够为信息图表、菜单、图表和营销素材资源生成清晰易读的风格化文本。**使用 Google 搜索进行接地**：模型可以使用 Google 搜索作为工具来验证事实，并根据实时数据（例如当前天气地图、股市图表、近期活动）生成图像。**Gemini 3.1 Flash Image**除了集成网页搜索接地之外，还集成了 Google 图片搜索接地。

**思考模式**：模型会利用“思考”过程来推理复杂的提示。它会生成临时“构思图片”（在后端可见，但不收费），以在生成最终的高质量输出之前优化构图。**最多 14 张参考图片**：您现在最多可以混合使用 14 张参考图片来生成最终图片。**新的宽高比**：Gemini 3.1 Flash Image 预览版新增了 1:4、4:1、1:8 和 8:1 的[宽高比](#aspect_ratios_and_image_size)。

### 使用最多 14 张参考图片

Gemini 3 图片模型可让您混合最多 14 张参考图片。这 14 张图片可以包含以下内容：

| Gemini 3.1 Flash 图片预览 | Gemini 3 Pro Image 预览版 |
|---|---|
| 最多 10 张高保真对象图片，用于包含在最终图片中 | 最多 6 张高保真对象图片，用于包含在最终图片中 |
| 最多 4 张角色图片，以保持角色一致性 | 最多 5 张角色图片，以保持角色一致性 |

### Python

```
from google import genai
from google.genai import types
from PIL import Image
prompt = "An office group photo of these people, they are making funny faces."
aspect_ratio = "5:4" # "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
resolution = "2K" # "512", "1K", "2K", "4K"
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[
prompt,
Image.open('person1.png'),
Image.open('person2.png'),
Image.open('person3.png'),
Image.open('person4.png'),
Image.open('person5.png'),
],
config=types.GenerateContentConfig(
response_modalities=['TEXT', 'IMAGE'],
image_config=types.ImageConfig(
aspect_ratio=aspect_ratio,
image_size=resolution
),
)
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("office.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
'An office group photo of these people, they are making funny faces.';
const aspectRatio = '5:4';
const resolution = '2K';
const contents = [
{ text: prompt },
{
inlineData: {
mimeType: "image/jpeg",
data: base64ImageFile1,
},
},
{
inlineData: {
mimeType: "image/jpeg",
data: base64ImageFile2,
},
},
{
inlineData: {
mimeType: "image/jpeg",
data: base64ImageFile3,
},
},
{
inlineData: {
mimeType: "image/jpeg",
data: base64ImageFile4,
},
},
{
inlineData: {
mimeType: "image/jpeg",
data: base64ImageFile5,
},
}
];
const response = await ai.models.generateContent({
model: 'gemini-3.1-flash-image-preview',
contents: contents,
config: {
responseModalities: ['TEXT', 'IMAGE'],
imageConfig: {
aspectRatio: aspectRatio,
imageSize: resolution,
},
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("image.png", buffer);
console.log("Image saved as image.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Text, genai.Image},
ImageConfig: &pb.ImageConfig{
AspectRatio: "5:4",
ImageSize: "2K",
},
}
img1, err := os.ReadFile("person1.png")
if err != nil { log.Fatal(err) }
img2, err := os.ReadFile("person2.png")
if err != nil { log.Fatal(err) }
img3, err := os.ReadFile("person3.png")
if err != nil { log.Fatal(err) }
img4, err := os.ReadFile("person4.png")
if err != nil { log.Fatal(err) }
img5, err := os.ReadFile("person5.png")
if err != nil { log.Fatal(err) }
parts := []genai.Part{
genai.Text("An office group photo of these people, they are making funny faces."),
genai.ImageData{MIMEType: "image/png", Data: img1},
genai.ImageData{MIMEType: "image/png", Data: img2},
genai.ImageData{MIMEType: "image/png", Data: img3},
genai.ImageData{MIMEType: "image/png", Data: img4},
genai.ImageData{MIMEType: "image/png", Data: img5},
}
resp, err := model.GenerateContent(ctx, parts...)
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("office.png", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.ImageConfig;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class GroupPhoto {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio("5:4")
.imageSize("2K")
.build())
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromText("An office group photo of these people, they are making funny faces."),
Part.fromBytes(Files.readAllBytes(Path.of("person1.png")), "image/png"),
Part.fromBytes(Files.readAllBytes(Path.of("person2.png")), "image/png"),
Part.fromBytes(Files.readAllBytes(Path.of("person3.png")), "image/png"),
Part.fromBytes(Files.readAllBytes(Path.of("person4.png")), "image/png"),
Part.fromBytes(Files.readAllBytes(Path.of("person5.png")), "image/png")
), config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("office.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{\"text\": \"An office group photo of these people, they are making funny faces.\"},
{\"inline_data\": {\"mime_type\":\"image/png\", \"data\": \"<BASE64_DATA_IMG_1>\"}},
{\"inline_data\": {\"mime_type\":\"image/png\", \"data\": \"<BASE64_DATA_IMG_2>\"}},
{\"inline_data\": {\"mime_type\":\"image/png\", \"data\": \"<BASE64_DATA_IMG_3>\"}},
{\"inline_data\": {\"mime_type\":\"image/png\", \"data\": \"<BASE64_DATA_IMG_4>\"}},
{\"inline_data\": {\"mime_type\":\"image/png\", \"data\": \"<BASE64_DATA_IMG_5>\"}}
]
}],
\"generationConfig\": {
\"responseModalities\": [\"TEXT\", \"IMAGE\"],
\"imageConfig\": {
\"aspectRatio\": \"5:4\",
\"imageSize\": \"2K\"
}
}
}"
```


![AI 生成的办公室合影](https://ai.google.dev/static/gemini-api/docs/images/office-group-photo.jpeg?hl=zh-cn)

### 使用 Google 搜索建立依据

使用 [Google 搜索工具](https://ai.google.dev/gemini-api/docs/google-search?hl=zh-cn)根据实时信息（例如天气预报、股票图表或近期活动）生成图片。

请注意，将“依托 Google 搜索进行接地”与图片生成功能搭配使用时，基于图片的搜索结果不会传递给生成模型，并且会从回答中排除（请参阅[依托 Google 图片搜索进行接地](#image-search)）

### Python

```
from google import genai
prompt = "Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart. Add a visual on what I should wear each day"
aspect_ratio = "16:9" # "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=prompt,
config=types.GenerateContentConfig(
response_modalities=['Text', 'Image'],
image_config=types.ImageConfig(
aspect_ratio=aspect_ratio,
),
tools=[{"google_search": {}}]
)
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("weather.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt = 'Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart. Add a visual on what I should wear each day';
const aspectRatio = '16:9';
const resolution = '2K';
const response = await ai.models.generateContent({
model: 'gemini-3.1-flash-image-preview',
contents: prompt,
config: {
responseModalities: ['TEXT', 'IMAGE'],
imageConfig: {
aspectRatio: aspectRatio,
imageSize: resolution,
},
tools: [{ googleSearch: {} }]
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("image.png", buffer);
console.log("Image saved as image.png");
}
}
}
main();
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.GoogleSearch;
import com.google.genai.types.ImageConfig;
import com.google.genai.types.Part;
import com.google.genai.types.Tool;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class SearchGrounding {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio("16:9")
.build())
.tools(Tool.builder()
.googleSearch(GoogleSearch.builder().build())
.build())
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview", """
Visualize the current weather forecast for the next 5 days
in San Francisco as a clean, modern weather chart.
Add a visual on what I should wear each day
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("weather.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{"parts": [{"text": "Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart. Add a visual on what I should wear each day"}]}],
"tools": [{"google_search": {}}],
"generationConfig": {
"responseModalities": ["TEXT", "IMAGE"],
"imageConfig": {"aspectRatio": "16:9"}
}
}'
```


![AI 生成的旧金山五天天气图表](https://ai.google.dev/static/gemini-api/docs/images/weather-forecast.png?hl=zh-cn)

响应包含 `groundingMetadata`

，其中包含以下必需字段：

：包含用于呈现所需搜索建议的 HTML 和 CSS。`searchEntryPoint`

：返回用于为生成的图片提供依据的前 3 个网络来源`groundingChunks`


### 依托 Google 图片搜索进行接地（3.1 Flash）

借助 Google 图片搜索建立依据功能，模型可以使用通过 Google 图片搜索检索到的网络图片作为视觉上下文来生成图片。图片搜索是“与 Google 搜索连接”工具中的一种新搜索类型，可与标准[网页搜索](#use-with-grounding)配合使用。

如需启用图片搜索，请在 API 请求中配置 `googleSearch`

工具，并在 `searchTypes`

对象中指定 `imageSearch`

。图片搜索可以单独使用，也可以与网页搜索一起使用。

### Python

```
from google import genai
prompt = "A detailed painting of a Timareta butterfly resting on a flower"
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=prompt,
config=types.GenerateContentConfig(
response_modalities=["IMAGE"],
tools=[
types.Tool(google_search=types.GoogleSearch(
search_types=types.SearchTypes(
web_search=types.WebSearch(),
image_search=types.ImageSearch()
)
))
]
)
)
# Display grounding sources if available
if response.candidates and response.candidates[0].grounding_metadata and response.candidates[0].grounding_metadata.search_entry_point:
display(HTML(response.candidates[0].grounding_metadata.search_entry_point.rendered_content))
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
async function main() {
const ai = new GoogleGenAI({});
const prompt = "A detailed painting of a Timareta butterfly resting on a flower";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
config: {
responseModalities: ["IMAGE"],
tools: [
{
googleSearch: {
searchTypes: {
webSearch: {},
imageSearch: {}
}
}
}
]
}
});
// Display grounding sources if available
if (response.candidates && response.candidates[0].groundingMetadata && response.candidates[0].groundingMetadata.searchEntryPoint) {
console.log(response.candidates[0].groundingMetadata.searchEntryPoint.renderedContent);
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"google.golang.org/genai"
pb "google.golang.org/genai/schema"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.Tools = []*pb.Tool{
{
GoogleSearch: &pb.GoogleSearch{
SearchTypes: &pb.SearchTypes{
WebSearch: &pb.WebSearch{},
ImageSearch: &pb.ImageSearch{},
},
},
},
}
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Image},
}
prompt := "A detailed painting of a Timareta butterfly resting on a flower"
resp, err := model.GenerateContent(ctx, genai.Text(prompt))
if err != nil {
log.Fatal(err)
}
if resp.Candidates[0].GroundingMetadata != nil && resp.Candidates[0].GroundingMetadata.SearchEntryPoint != nil {
fmt.Println(resp.Candidates[0].GroundingMetadata.SearchEntryPoint.RenderedContent)
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{"parts": [{"text": "A detailed painting of a Timareta butterfly resting on a flower"}]}],
"tools": [{"google_search": {"searchTypes": {"webSearch": {}, "imageSearch": {}}}}],
"generationConfig": {
"responseModalities": ["IMAGE"]
}
}'
```


**展示要求**

在“依托 Google 搜索进行接地”中使用图片搜索时，您必须遵守以下条件：

**来源信息提供**：您必须以用户能够识别为链接的方式，提供指向包含来源图片的网页（“包含网页”，而非图片文件本身）的链接。**直接导航**：如果您还选择显示来源图片，则必须提供从来源图片到其所在来源网页的直接单点点击路径。任何其他延迟或抽象化最终用户对源网页的访问的实现方式（包括但不限于任何多点击路径或使用中间图片查看器）均不允许。

**答案**

对于使用图片搜索的有依据的回答，该 API 会提供清晰的提供方信息和元数据，以将其输出内容与经过验证的来源相关联。`groundingMetadata`

对象中的关键字段包括：

：模型用于视觉上下文（图片搜索）的具体查询。`imageSearchQueries`

：包含检索到的结果的来源信息。 对于图片来源，这些来源将使用新的图片块类型作为重定向网址返回。此块包含：`groundingChunks`

：用于提供提供方信息的网页网址（着陆页）。`uri`

：直接图片网址。`image_uri`


：提供具体映射，将生成的内容与块中的相关引用来源相关联。`groundingSupports`

：包含“Google 搜索”功能块，其中包含符合要求的 HTML 和 CSS，用于呈现搜索建议。`searchEntryPoint`


### 生成分辨率最高为 4K 的图片

Gemini 3 图片模型默认生成 1K 图片，但也可以输出 2K、4K 和 512 (0.5K)（仅限 Gemini 3.1 Flash Image）图片。如需生成更高分辨率的素材资源，请在 `generation_config`

中指定 `image_size`

。

您必须使用大写“K”（例如 1K、2K、4K）。`512`

值未使用“K”后缀。系统会拒绝小写参数（例如 1k）。

### Python

```
from google import genai
from google.genai import types
prompt = "Da Vinci style anatomical sketch of a dissected Monarch butterfly. Detailed drawings of the head, wings, and legs on textured parchment with notes in English."
aspect_ratio = "1:1" # "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
resolution = "1K" # "512", "1K", "2K", "4K"
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=prompt,
config=types.GenerateContentConfig(
response_modalities=['TEXT', 'IMAGE'],
image_config=types.ImageConfig(
aspect_ratio=aspect_ratio,
image_size=resolution
),
)
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("butterfly.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
'Da Vinci style anatomical sketch of a dissected Monarch butterfly. Detailed drawings of the head, wings, and legs on textured parchment with notes in English.';
const aspectRatio = '1:1';
const resolution = '1K';
const response = await ai.models.generateContent({
model: 'gemini-3.1-flash-image-preview',
contents: prompt,
config: {
responseModalities: ['TEXT', 'IMAGE'],
imageConfig: {
aspectRatio: aspectRatio,
imageSize: resolution,
},
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("image.png", buffer);
console.log("Image saved as image.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Text, genai.Image},
ImageConfig: &pb.ImageConfig{
AspectRatio: "1:1",
ImageSize: "1K",
},
}
prompt := "Da Vinci style anatomical sketch of a dissected Monarch butterfly. Detailed drawings of the head, wings, and legs on textured parchment with notes in English."
resp, err := model.GenerateContent(ctx, genai.Text(prompt))
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("butterfly.png", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.GoogleSearch;
import com.google.genai.types.ImageConfig;
import com.google.genai.types.Part;
import com.google.genai.types.Tool;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class HiRes {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio("16:9")
.imageSize("4K")
.build())
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview", """
Da Vinci style anatomical sketch of a dissected Monarch butterfly.
Detailed drawings of the head, wings, and legs on textured
parchment with notes in English.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("butterfly.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{"parts": [{"text": "Da Vinci style anatomical sketch of a dissected Monarch butterfly. Detailed drawings of the head, wings, and legs on textured parchment with notes in English."}]}],
"tools": [{"google_search": {}}],
"generationConfig": {
"responseModalities": ["TEXT", "IMAGE"],
"imageConfig": {"aspectRatio": "1:1", "imageSize": "1K"}
}
}'
```


以下是根据此提示生成的示例图片：

![AI 生成的达芬奇风格的解剖帝王蝶的解剖图。](https://ai.google.dev/static/gemini-api/docs/images/gemini3-4k-image.png?hl=zh-cn)

### 思维过程

Gemini 3 图片模型是一种思维模型，可针对复杂的提示使用推理流程（“思考”）。此功能默认处于启用状态，并且无法在 API 中停用。如需详细了解思考过程，请参阅 [Gemini 思考](https://ai.google.dev/gemini-api/docs/thinking?hl=zh-cn)指南。

模型最多会生成两张临时图片，以测试构图和逻辑。“思考”中的最后一张图片也是最终渲染的图片。

您可以查看生成最终图片所依据的想法。

### Python

```
for part in response.parts:
if part.thought:
if part.text:
print(part.text)
elif image:= part.as_image():
image.show()
```


### JavaScript

```
for (const part of response.candidates[0].content.parts) {
if (part.thought) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, 'base64');
fs.writeFileSync('image.png', buffer);
console.log('Image saved as image.png');
}
}
}
```


#### 控制思考等级

借助 Gemini 3.1 Flash Image，您可以控制模型使用的思考量，以平衡质量和延迟时间。默认 `thinkingLevel`

为 `minimal`

，支持的级别为 `minimal`

和 `high`

。

您可以添加 `includeThoughts`

布尔值来确定模型生成的想法是在回答中返回还是保持隐藏。

### Python

```
from google import genai
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="A futuristic city built inside a giant glass bottle floating in space",
config=types.GenerateContentConfig(
response_modalities=["IMAGE"],
thinking_config=types.ThinkingConfig(
thinking_level="High",
include_thoughts=True
),
)
)
for part in response.parts:
if part.thought: # Skip outputting thoughts
continue
if part.text:
display(Markdown(part.text))
elif image:= part.as_image():
image.show()
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: "A futuristic city built inside a giant glass bottle floating in space",
config: {
responseModalities: ["IMAGE"],
thinkingConfig: {
thinkingLevel: "High",
includeThoughts: true
},
},
});
for (const part of response.candidates[0].content.parts) {
if (part.thought) { // Skip outputting thoughts
continue;
}
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("image.png", buffer);
console.log("Image saved as image.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
pb "google.golang.org/genai/schema"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Image},
ThinkingConfig: &pb.ThinkingConfig{
ThinkingLevel: "High",
IncludeThoughts: true,
},
}
prompt := "A futuristic city built inside a giant glass bottle floating in space"
resp, err := model.GenerateContent(ctx, genai.Text(prompt))
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if part.Thought { // Skip outputting thoughts
continue
}
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("image.png", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{"parts": [{"text": "A futuristic city built inside a giant glass bottle floating in space"}]}],
"generationConfig": {
"responseModalities": ["IMAGE"],
"thinkingConfig": {
"thinkingLevel": "High",
"includeThoughts": true
}
}
}'
```


请注意，无论 `includeThoughts`

设置为 `true`

还是 `false`

，系统都会对思考令牌收费，因为无论您是否查看思考过程，系统默认都会进行[思考过程](#thinking-process)。

#### 思考签名

思考签名是模型内部思考过程的加密表示形式，用于在多轮互动中保留推理上下文。所有响应都包含 `thought_signature`

字段。一般来说，如果您在模型响应中收到思考签名，则应在下一轮对话中发送对话历史记录时，完全按收到的原样将其传递回去。未能循环使用想法签名可能会导致回答失败。如需详细了解签名，请参阅[思想签名](https://ai.google.dev/gemini-api/docs/thought-signatures?hl=zh-cn)文档。

思考签名的运作方式如下：

- 所有包含图片
`mimetype`

的`inline_data`

部分（属于响应的一部分）都应具有签名。 - 如果想法之后（在任何图片之前）紧跟着一些文字部分，则第一个文字部分也应包含签名。
- 如果包含图片
`mimetype`

的`inline_data`

部分是想法的一部分，则不会有签名。

以下代码展示了包含思维签名的示例：

```
[
{
"inline_data": {
"data": "<base64_image_data_0>",
"mime_type": "image/png"
},
"thought": true // Thoughts don't have signatures
},
{
"inline_data": {
"data": "<base64_image_data_1>",
"mime_type": "image/png"
},
"thought": true // Thoughts don't have signatures
},
{
"inline_data": {
"data": "<base64_image_data_2>",
"mime_type": "image/png"
},
"thought": true // Thoughts don't have signatures
},
{
"text": "Here is a step-by-step guide to baking macarons, presented in three separate images.\n\n### Step 1: Piping the Batter\n\nThe first step after making your macaron batter is to pipe it onto a baking sheet. This requires a steady hand to create uniform circles.\n\n",
"thought_signature": "<Signature_A>" // The first non-thought part always has a signature
},
{
"inline_data": {
"data": "<base64_image_data_3>",
"mime_type": "image/png"
},
"thought_signature": "<Signature_B>" // All image parts have a signatures
},
{
"text": "\n\n### Step 2: Baking and Developing Feet\n\nOnce piped, the macarons are baked in the oven. A key sign of a successful bake is the development of \"feet\"—the ruffled edge at the base of each macaron shell.\n\n"
// Follow-up text parts don't have signatures
},
{
"inline_data": {
"data": "<base64_image_data_4>",
"mime_type": "image/png"
},
"thought_signature": "<Signature_C>" // All image parts have a signatures
},
{
"text": "\n\n### Step 3: Assembling the Macaron\n\nThe final step is to pair the cooled macaron shells by size and sandwich them together with your desired filling, creating the classic macaron dessert.\n\n"
},
{
"inline_data": {
"data": "<base64_image_data_5>",
"mime_type": "image/png"
},
"thought_signature": "<Signature_D>" // All image parts have a signatures
}
]
```


## 其他图片生成模式

Gemini 还支持其他基于提示结构和上下文的图片互动模式，包括：

**文生图和文本（交织）**：输出包含相关文本的图片。- 提示示例：“生成一份图文并茂的海鲜饭食谱。”

**图片和文本转图片和文本（交织）**：使用输入图片和文本创建新的相关图片和文本。- 提示示例：（附带一张带家具的房间的照片）“我的空间还适合放置哪些颜色的沙发？你能更新一下图片吗？”


## 批量生成图片

如果您需要生成大量图片，可以使用[批量 API](https://ai.google.dev/gemini-api/docs/batch-api?hl=zh-cn)。您可获得更高的[速率限制](https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn)，但需要等待最长 24 小时才能获得解答。

如需查看 Batch API 图片示例和代码，请参阅 [Batch API 图片生成文档](https://ai.google.dev/gemini-api/docs/batch-api?hl=zh-cn#image-generation)和[实用指南](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Batch_mode.ipynb?hl=zh-cn)。

## 提示指南和策略

要掌握图片生成，首先要了解一个基本原则：


描述场景，而不仅仅是列出关键字。该模型的核心优势在于其深厚的语言理解能力。与一连串不相关的字词相比，叙述性、描述性段落几乎总是能生成更好、更连贯的图片。

### 用于生成图片的提示

以下策略将帮助您创建有效的提示，以生成您想要的图片。

#### 1. 逼真场景

对于逼真的图片，请使用摄影术语。提及拍摄角度、镜头类型、光线和细节，引导模型生成逼真的效果。

### 模板

```
A photorealistic [shot type] of [subject], [action or expression], set in
[environment]. The scene is illuminated by [lighting description], creating
a [mood] atmosphere. Captured with a [camera/lens details], emphasizing
[key textures and details]. The image should be in a [aspect ratio] format.
```


### 提示

```
A photorealistic close-up portrait of an elderly Japanese ceramicist with
deep, sun-etched wrinkles and a warm, knowing smile. He is carefully
inspecting a freshly glazed tea bowl. The setting is his rustic,
sun-drenched workshop. The scene is illuminated by soft, golden hour light
streaming through a window, highlighting the fine texture of the clay.
Captured with an 85mm portrait lens, resulting in a soft, blurred background
(bokeh). The overall mood is serene and masterful. Vertical portrait
orientation.
```


### Python

```
from google import genai
from google.genai import types
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful.",
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("photorealistic_example.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful.";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("photorealistic_example.png", buffer);
console.log("Image saved as photorealistic_example.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful."),
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "photorealistic_example.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class PhotorealisticScene {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"""
A photorealistic close-up portrait of an elderly Japanese ceramicist
with deep, sun-etched wrinkles and a warm, knowing smile. He is
carefully inspecting a freshly glazed tea bowl. The setting is his
rustic, sun-drenched workshop with pottery wheels and shelves of
clay pots in the background. The scene is illuminated by soft,
golden hour light streaming through a window, highlighting the
fine texture of the clay and the fabric of his apron. Captured
with an 85mm portrait lens, resulting in a soft, blurred
background (bokeh). The overall mood is serene and masterful.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("photorealistic_example.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful."}
]
}]
}'
```


![一张写实风格的特写肖像照，照片中是一位年长的日本陶艺家...](https://ai.google.dev/static/gemini-api/docs/images/photorealistic_example.png?hl=zh-cn)

#### 2. 风格化插图和贴纸

如需创建贴纸、图标或素材资源，请明确说明样式并请求透明背景。

### 模板

```
A [style] sticker of a [subject], featuring [key characteristics] and a
[color palette]. The design should have [line style] and [shading style].
The background must be transparent.
```


### 提示

```
A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's
munching on a green bamboo leaf. The design features bold, clean outlines,
simple cel-shading, and a vibrant color palette. The background must be white.
```


### Python

```
from google import genai
from google.genai import types
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white.",
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("red_panda_sticker.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white.";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("red_panda_sticker.png", buffer);
console.log("Image saved as red_panda_sticker.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white."),
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "red_panda_sticker.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class StylizedIllustration {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"""
A kawaii-style sticker of a happy red panda wearing a tiny bamboo
hat. It's munching on a green bamboo leaf. The design features
bold, clean outlines, simple cel-shading, and a vibrant color
palette. The background must be white.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("red_panda_sticker.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It is munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white."}
]
}]
}'
```


![一张可爱风格的贴纸，上面画着一个开心的红色...](https://ai.google.dev/static/gemini-api/docs/images/red_panda_sticker.png?hl=zh-cn)

#### 3. 图片中的文字准确无误

Gemini 在呈现文本方面表现出色。清楚说明文字、字体样式（描述性）和整体设计。使用 Gemini 3 Pro Image 预览版制作专业资源。

### 模板

```
Create a [image type] for [brand/concept] with the text "[text to render]"
in a [font style]. The design should be [style description], with a
[color scheme].
```


### 提示

```
Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.
```


### Python

```
from google import genai
from google.genai import types
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.",
config=types.GenerateContentConfig(
image_config=types.ImageConfig(
aspect_ratio="1:1",
)
)
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("logo_example.jpg")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
config: {
imageConfig: {
aspectRatio: "1:1",
},
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("logo_example.jpg", buffer);
console.log("Image saved as logo_example.jpg");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way."),
&genai.GenerateContentConfig{
ImageConfig: &genai.ImageConfig{
AspectRatio: "1:1",
},
},
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "logo_example.jpg"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.google.genai.types.ImageConfig;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class AccurateTextInImages {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio("1:1")
.build())
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"""
Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("logo_example.jpg"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "Create a modern, minimalist logo for a coffee shop called The Daily Grind. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way."}
]
}],
"generationConfig": {
"imageConfig": {
"aspectRatio": "1:1"
}
}
}'
```


![为一家名为“The Daily Grind”的咖啡店设计一个现代简约的徽标…](https://ai.google.dev/static/gemini-api/docs/images/logo_example.jpg?hl=zh-cn)

#### 4. 产品模型和商业摄影

非常适合为电子商务、广告或品牌宣传拍摄清晰专业的商品照片。

### 模板

```
A high-resolution, studio-lit product photograph of a [product description]
on a [background surface/description]. The lighting is a [lighting setup,
e.g., three-point softbox setup] to [lighting purpose]. The camera angle is
a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp
focus on [key detail]. [Aspect ratio].
```


### 提示

```
A high-resolution, studio-lit product photograph of a minimalist ceramic
coffee mug in matte black, presented on a polished concrete surface. The
lighting is a three-point softbox setup designed to create soft, diffused
highlights and eliminate harsh shadows. The camera angle is a slightly
elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with
sharp focus on the steam rising from the coffee. Square image.
```


### Python

```
from google import genai
from google.genai import types
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image.",
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("product_mockup.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image.";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("product_mockup.png", buffer);
console.log("Image saved as product_mockup.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image."),
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "product_mockup.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class ProductMockup {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"""
A high-resolution, studio-lit product photograph of a minimalist
ceramic coffee mug in matte black, presented on a polished
concrete surface. The lighting is a three-point softbox setup
designed to create soft, diffused highlights and eliminate harsh
shadows. The camera angle is a slightly elevated 45-degree shot
to showcase its clean lines. Ultra-realistic, with sharp focus
on the steam rising from the coffee. Square image.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("product_mockup.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image."}
]
}]
}'
```


![一张高分辨率的棚拍商品照片，展示的是一个极简的陶瓷咖啡杯...](https://ai.google.dev/static/gemini-api/docs/images/product_mockup.png?hl=zh-cn)

#### 5. 极简风格和负空间设计

非常适合用于创建网站、演示或营销材料的背景，以便在其中叠加文字。

### 模板

```
A minimalist composition featuring a single [subject] positioned in the
[bottom-right/top-left/etc.] of the frame. The background is a vast, empty
[color] canvas, creating significant negative space. Soft, subtle lighting.
[Aspect ratio].
```


### 提示

```
A minimalist composition featuring a single, delicate red maple leaf
positioned in the bottom-right of the frame. The background is a vast, empty
off-white canvas, creating significant negative space for text. Soft,
diffused lighting from the top left. Square image.
```


### Python

```
from google import genai
from google.genai import types
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents="A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image.",
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("minimalist_design.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt =
"A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image.";
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("minimalist_design.png", buffer);
console.log("Image saved as minimalist_design.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image."),
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "minimalist_design.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class MinimalistDesign {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
"""
A minimalist composition featuring a single, delicate red maple
leaf positioned in the bottom-right of the frame. The background
is a vast, empty off-white canvas, creating significant negative
space for text. Soft, diffused lighting from the top left.
Square image.
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("minimalist_design.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image."}
]
}]
}'
```


![一幅极简主义构图，画面中只有一片精致的红枫叶...](https://ai.google.dev/static/gemini-api/docs/images/minimalist_design.png?hl=zh-cn)

#### 6. 连续艺术（漫画分格 / 故事板）

以角色一致性和场景描述为基础，为视觉故事讲述创建分格。为了确保文本准确性和叙事能力，这些提示最适合搭配 Gemini 3 Pro 和 Gemini 3.1 Flash Image 预览版使用。

### 模板

```
Make a 3 panel comic in a [style]. Put the character in a [type of scene].
```


### 提示

```
Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene.
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
image_input = Image.open('/path/to/your/man_in_white_glasses.jpg')
text_input = "Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene."
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[text_input, image_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("comic_panel.jpg")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/man_in_white_glasses.jpg";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{text: "Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene."},
{
inlineData: {
mimeType: "image/jpeg",
data: base64Image,
},
},
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("comic_panel.jpg", buffer);
console.log("Image saved as comic_panel.jpg");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/your/man_in_white_glasses.jpg"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
genai.NewPartFromText("Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene."),
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/jpeg",
Data: imgData,
},
},
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "comic_panel.jpg"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class ComicPanel {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromText("""
Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene.
"""),
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/man_in_white_glasses.jpg")),
"image/jpeg")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("comic_panel.jpg"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene."},
{"inline_data": {"mime_type": "image/jpeg", "data": "<BASE64_IMAGE_DATA>"}}
]
}]
}'
```


输入 |
输出 |
![]() |
![]() |

#### 7. 使用 Google 搜索建立依据

使用 Google 搜索根据最新信息或实时信息生成图片。 这对于新闻、天气和其他时效性强的主题非常有用。

### 提示

```
Make a simple but stylish graphic of last night's Arsenal game in the Champion's League
```


### Python

```
from google import genai
from google.genai import types
prompt = "Make a simple but stylish graphic of last night's Arsenal game in the Champion's League"
aspect_ratio = "16:9" # "1:1","1:4","1:8","2:3","3:2","3:4","4:1","4:3","4:5","5:4","8:1","9:16","16:9","21:9"
client = genai.Client()
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=prompt,
config=types.GenerateContentConfig(
response_modalities=['Text', 'Image'],
image_config=types.ImageConfig(
aspect_ratio=aspect_ratio,
),
tools=[{"google_search": {}}]
)
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif image:= part.as_image():
image.save("football-score.jpg")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const prompt = "Make a simple but stylish graphic of last night's Arsenal game in the Champion's League";
const aspectRatio = '16:9';
const resolution = '2K';
const response = await ai.models.generateContent({
model: 'gemini-3.1-flash-image-preview',
contents: prompt,
config: {
responseModalities: ['TEXT', 'IMAGE'],
imageConfig: {
aspectRatio: aspectRatio,
imageSize: resolution,
},
tools: [{"google_search": {}}],
},
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("football-score.jpg", buffer);
console.log("Image saved as football-score.jpg");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
pb "google.golang.org/genai/schema"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
defer client.Close()
model := client.GenerativeModel("gemini-3.1-flash-image-preview")
model.Tools = []*pb.Tool{
pb.NewGoogleSearchTool(),
}
model.GenerationConfig = &pb.GenerationConfig{
ResponseModalities: []pb.ResponseModality{genai.Text, genai.Image},
ImageConfig: &pb.ImageConfig{
AspectRatio: "16:9",
},
}
prompt := "Make a simple but stylish graphic of last night's Arsenal game in the Champion's League"
resp, err := model.GenerateContent(ctx, genai.Text(prompt))
if err != nil {
log.Fatal(err)
}
for _, part := range resp.Candidates[0].Content.Parts {
if txt, ok := part.(genai.Text); ok {
fmt.Printf("%s", string(txt))
} else if img, ok := part.(genai.ImageData); ok {
err := os.WriteFile("football-score.jpg", img.Data, 0644)
if err != nil {
log.Fatal(err)
}
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.GoogleSearch;
import com.google.genai.types.ImageConfig;
import com.google.genai.types.Part;
import com.google.genai.types.Tool;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
public class SearchGrounding {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.imageConfig(ImageConfig.builder()
.aspectRatio("16:9")
.build())
.tools(Tool.builder()
.googleSearch(GoogleSearch.builder().build())
.build())
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview", """
Make a simple but stylish graphic of last night's Arsenal game in the Champion's League
""",
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("football-score.jpg"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{"parts": [{"text": "Make a simple but stylish graphic of last nights Arsenal game in the Champions League"}]}],
"tools": [{"google_search": {}}],
"generationConfig": {
"responseModalities": ["TEXT", "IMAGE"],
"imageConfig": {"aspectRatio": "16:9"}
}
}'
```


![AI 生成的阿森纳足球比赛得分图片](https://ai.google.dev/static/gemini-api/docs/images/football-score.jpg?hl=zh-cn)

### 用于修改图片的提示

以下示例展示了如何提供图片以及文本提示，以进行编辑、构图和风格迁移。

#### 1. 添加和移除元素

提供图片并描述您的更改。模型将与原始图片的风格、光照和透视效果保持一致。

### 模板

```
Using the provided image of [subject], please [add/remove/modify] [element]
to/from the scene. Ensure the change is [description of how the change should
integrate].
```


### 提示

```
"Using the provided image of my cat, please add a small, knitted wizard hat
on its head. Make it look like it's sitting comfortably and matches the soft
lighting of the photo."
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
# Base image prompt: "A photorealistic picture of a fluffy ginger cat sitting on a wooden floor, looking directly at the camera. Soft, natural light from a window."
image_input = Image.open('/path/to/your/cat_photo.png')
text_input = """Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and not falling off."""
# Generate an image from a text prompt
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[text_input, image_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("cat_with_hat.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/cat_photo.png";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{ text: "Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and not falling off." },
{
inlineData: {
mimeType: "image/png",
data: base64Image,
},
},
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("cat_with_hat.png", buffer);
console.log("Image saved as cat_with_hat.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/your/cat_photo.png"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
genai.NewPartFromText("Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and not falling off."),
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData,
},
},
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "cat_with_hat.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class AddRemoveElements {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromText("""
Using the provided image of my cat, please add a small,
knitted wizard hat on its head. Make it look like it's
sitting comfortably and not falling off.
"""),
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/cat_photo.png")),
"image/png")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("cat_with_hat.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{\"text\": \"Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and not falling off.\"},
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
}
]
}]
}"
```


输入 |
输出 |
![]() |
![]() |

#### 2. 局部重绘（语义遮盖）

通过对话定义“蒙版”，以修改图片的特定部分，同时保持其余部分不变。

### 模板

```
Using the provided image, change only the [specific element] to [new
element/description]. Keep everything else in the image exactly the same,
preserving the original style, lighting, and composition.
```


### 提示

```
"Using the provided image of a living room, change only the blue sofa to be
a vintage, brown leather chesterfield sofa. Keep the rest of the room,
including the pillows on the sofa and the lighting, unchanged."
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
# Base image prompt: "A wide shot of a modern, well-lit living room with a prominent blue sofa in the center. A coffee table is in front of it and a large window is in the background."
living_room_image = Image.open('/path/to/your/living_room.png')
text_input = """Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged."""
# Generate an image from a text prompt
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[living_room_image, text_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("living_room_edited.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/living_room.png";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{
inlineData: {
mimeType: "image/png",
data: base64Image,
},
},
{ text: "Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged." },
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("living_room_edited.png", buffer);
console.log("Image saved as living_room_edited.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/your/living_room.png"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData,
},
},
genai.NewPartFromText("Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged."),
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "living_room_edited.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class Inpainting {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/living_room.png")),
"image/png"),
Part.fromText("""
Using the provided image of a living room, change
only the blue sofa to be a vintage, brown leather
chesterfield sofa. Keep the rest of the room,
including the pillows on the sofa and the lighting,
unchanged.
""")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("living_room_edited.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
},
{\"text\": \"Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged.\"}
]
}]
}"
```


输入 |
输出 |
![]() |
![]() |

#### 3. 风格迁移

提供一张图片，并让模型以不同的艺术风格重新创作其内容。

### 模板

```
Transform the provided photograph of [subject] into the artistic style of [artist/art style]. Preserve the original composition but render it with [description of stylistic elements].
```


### 提示

```
"Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows."
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
# Base image prompt: "A photorealistic, high-resolution photograph of a busy city street in New York at night, with bright neon signs, yellow taxis, and tall skyscrapers."
city_image = Image.open('/path/to/your/city.png')
text_input = """Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows."""
# Generate an image from a text prompt
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[city_image, text_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("city_style_transfer.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/city.png";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{
inlineData: {
mimeType: "image/png",
data: base64Image,
},
},
{ text: "Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows." },
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("city_style_transfer.png", buffer);
console.log("Image saved as city_style_transfer.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/your/city.png"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData,
},
},
genai.NewPartFromText("Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows."),
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "city_style_transfer.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class StyleTransfer {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/city.png")),
"image/png"),
Part.fromText("""
Transform the provided photograph of a modern city
street at night into the artistic style of
Vincent van Gogh's 'Starry Night'. Preserve the
original composition of buildings and cars, but
render all elements with swirling, impasto
brushstrokes and a dramatic palette of deep blues
and bright yellows.
""")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("city_style_transfer.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
},
{\"text\": \"Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows.\"}
]
}]
}"
```


输入 |
输出 |
![]() |
![]() |

#### 4. 高级合成：组合多张图片

提供多张图片作为上下文，以创建新的合成场景。这非常适合制作产品模型或创意拼贴画。

### 模板

```
Create a new image by combining the elements from the provided images. Take
the [element from image 1] and place it with/on the [element from image 2].
The final image should be a [description of the final scene].
```


### 提示

```
"Create a professional e-commerce fashion photo. Take the blue floral dress
from the first image and let the woman from the second image wear it.
Generate a realistic, full-body shot of the woman wearing the dress, with
the lighting and shadows adjusted to match the outdoor environment."
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
# Base image prompts:
# 1. Dress: "A professionally shot photo of a blue floral summer dress on a plain white background, ghost mannequin style."
# 2. Model: "Full-body shot of a woman with her hair in a bun, smiling, standing against a neutral grey studio background."
dress_image = Image.open('/path/to/your/dress.png')
model_image = Image.open('/path/to/your/model.png')
text_input = """Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment."""
# Generate an image from a text prompt
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[dress_image, model_image, text_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("fashion_ecommerce_shot.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath1 = "/path/to/your/dress.png";
const imageData1 = fs.readFileSync(imagePath1);
const base64Image1 = imageData1.toString("base64");
const imagePath2 = "/path/to/your/model.png";
const imageData2 = fs.readFileSync(imagePath2);
const base64Image2 = imageData2.toString("base64");
const prompt = [
{
inlineData: {
mimeType: "image/png",
data: base64Image1,
},
},
{
inlineData: {
mimeType: "image/png",
data: base64Image2,
},
},
{ text: "Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment." },
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("fashion_ecommerce_shot.png", buffer);
console.log("Image saved as fashion_ecommerce_shot.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imgData1, _ := os.ReadFile("/path/to/your/dress.png")
imgData2, _ := os.ReadFile("/path/to/your/model.png")
parts := []*genai.Part{
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData1,
},
},
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData2,
},
},
genai.NewPartFromText("Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment."),
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "fashion_ecommerce_shot.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class AdvancedComposition {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/dress.png")),
"image/png"),
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/model.png")),
"image/png"),
Part.fromText("""
Create a professional e-commerce fashion photo.
Take the blue floral dress from the first image and
let the woman from the second image wear it. Generate
a realistic, full-body shot of the woman wearing the
dress, with the lighting and shadows adjusted to
match the outdoor environment.
""")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("fashion_ecommerce_shot.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA_1>\"
}
},
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA_2>\"
}
},
{\"text\": \"Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment.\"}
]
}]
}"
```


输入值 1 |
输入值 2 |
输出 |
![]() |
![]() |
![]() |

#### 5. 高保真细节保留

为确保在编辑过程中保留关键细节（例如面部或徽标），请在编辑请求中详细描述这些细节。

### 模板

```
Using the provided images, place [element from image 2] onto [element from
image 1]. Ensure that the features of [element from image 1] remain
completely unchanged. The added element should [description of how the
element should integrate].
```


### 提示

```
"Take the first image of the woman with brown hair, blue eyes, and a neutral
expression. Add the logo from the second image onto her black t-shirt.
Ensure the woman's face and features remain completely unchanged. The logo
should look like it's naturally printed on the fabric, following the folds
of the shirt."
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
# Base image prompts:
# 1. Woman: "A professional headshot of a woman with brown hair and blue eyes, wearing a plain black t-shirt, against a neutral studio background."
# 2. Logo: "A simple, modern logo with the letters 'G' and 'A' in a white circle."
woman_image = Image.open('/path/to/your/woman.png')
logo_image = Image.open('/path/to/your/logo.png')
text_input = """Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt."""
# Generate an image from a text prompt
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[woman_image, logo_image, text_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("woman_with_logo.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath1 = "/path/to/your/woman.png";
const imageData1 = fs.readFileSync(imagePath1);
const base64Image1 = imageData1.toString("base64");
const imagePath2 = "/path/to/your/logo.png";
const imageData2 = fs.readFileSync(imagePath2);
const base64Image2 = imageData2.toString("base64");
const prompt = [
{
inlineData: {
mimeType: "image/png",
data: base64Image1,
},
},
{
inlineData: {
mimeType: "image/png",
data: base64Image2,
},
},
{ text: "Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt." },
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("woman_with_logo.png", buffer);
console.log("Image saved as woman_with_logo.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imgData1, _ := os.ReadFile("/path/to/your/woman.png")
imgData2, _ := os.ReadFile("/path/to/your/logo.png")
parts := []*genai.Part{
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData1,
},
},
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData2,
},
},
genai.NewPartFromText("Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt."),
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "woman_with_logo.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class HighFidelity {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/woman.png")),
"image/png"),
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/logo.png")),
"image/png"),
Part.fromText("""
Take the first image of the woman with brown hair,
blue eyes, and a neutral expression. Add the logo
from the second image onto her black t-shirt.
Ensure the woman's face and features remain
completely unchanged. The logo should look like
it's naturally printed on the fabric, following
the folds of the shirt.
""")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("woman_with_logo.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA_1>\"
}
},
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA_2>\"
}
},
{\"text\": \"Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt.\"}
]
}]
}"
```


输入值 1 |
输入值 2 |
输出 |
![]() |
![]() |
![]() |

#### 6. 让事物变得生动有趣

上传草图或简笔画，然后让模型将其优化为成品图片。

### 模板

```
Turn this rough [medium] sketch of a [subject] into a [style description]
photo. Keep the [specific features] from the sketch but add [new details/materials].
```


### 提示

```
"Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting."
```


### Python

```
from google import genai
from PIL import Image
client = genai.Client()
# Base image prompt: "A rough pencil sketch of a flat sports car on white paper."
sketch_image = Image.open('/path/to/your/car_sketch.png')
text_input = """Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting."""
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[sketch_image, text_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("car_photo.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/car_sketch.png";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{
inlineData: {
mimeType: "image/png",
data: base64Image,
},
},
{ text: "Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting." },
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("car_photo.png", buffer);
console.log("Image saved as car_photo.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imgData, _ := os.ReadFile("/path/to/your/car_sketch.png")
parts := []*genai.Part{
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/png",
Data: imgData,
},
},
genai.NewPartFromText("Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting."),
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "car_photo.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class BringToLife {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/car_sketch.png")),
"image/png"),
Part.fromText("""
Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting.
""")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("car_photo.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{
\"inline_data\": {
\"mime_type\":\"image/png\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
},
{\"text\": \"Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting.\"}
]
}]
}"
```


输入 |
输出 |
![]() |
![]() |

#### 7. 角色一致性：360 度全景

您可以迭代提示不同的角度，从而生成角色的 360 度视图。为获得最佳效果，请在后续提示中添加之前生成的图片，以保持一致性。对于复杂的姿势，请添加所需姿势的参考图片。

### 模板

```
A studio portrait of [person] against [background], [looking forward/in profile looking right/etc.]
```


### 提示

```
A studio portrait of this man against white, in profile looking right
```


### Python

```
from google import genai
from google.genai import types
from PIL import Image
client = genai.Client()
image_input = Image.open('/path/to/your/man_in_white_glasses.jpg')
text_input = """A studio portrait of this man against white, in profile looking right"""
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[text_input, image_input],
)
for part in response.parts:
if part.text is not None:
print(part.text)
elif part.inline_data is not None:
image = part.as_image()
image.save("man_right_profile.png")
```


### JavaScript

```
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
async function main() {
const ai = new GoogleGenAI({});
const imagePath = "/path/to/your/man_in_white_glasses.jpg";
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");
const prompt = [
{ text: "A studio portrait of this man against white, in profile looking right" },
{
inlineData: {
mimeType: "image/jpeg",
data: base64Image,
},
},
];
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
});
for (const part of response.candidates[0].content.parts) {
if (part.text) {
console.log(part.text);
} else if (part.inlineData) {
const imageData = part.inlineData.data;
const buffer = Buffer.from(imageData, "base64");
fs.writeFileSync("man_right_profile.png", buffer);
console.log("Image saved as man_right_profile.png");
}
}
}
main();
```


### Go

```
package main
import (
"context"
"fmt"
"log"
"os"
"google.golang.org/genai"
)
func main() {
ctx := context.Background()
client, err := genai.NewClient(ctx, nil)
if err != nil {
log.Fatal(err)
}
imagePath := "/path/to/your/man_in_white_glasses.jpg"
imgData, _ := os.ReadFile(imagePath)
parts := []*genai.Part{
genai.NewPartFromText("A studio portrait of this man against white, in profile looking right"),
&genai.Part{
InlineData: &genai.Blob{
MIMEType: "image/jpeg",
Data: imgData,
},
},
}
contents := []*genai.Content{
genai.NewContentFromParts(parts, genai.RoleUser),
}
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
contents,
)
for _, part := range result.Candidates[0].Content.Parts {
if part.Text != "" {
fmt.Println(part.Text)
} else if part.InlineData != nil {
imageBytes := part.InlineData.Data
outputFilename := "man_right_profile.png"
_ = os.WriteFile(outputFilename, imageBytes, 0644)
}
}
}
```


### Java

```
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
public class CharacterConsistency {
public static void main(String[] args) throws IOException {
try (Client client = new Client()) {
GenerateContentConfig config = GenerateContentConfig.builder()
.responseModalities("TEXT", "IMAGE")
.build();
GenerateContentResponse response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
Content.fromParts(
Part.fromText("""
A studio portrait of this man against white, in profile looking right
"""),
Part.fromBytes(
Files.readAllBytes(
Path.of("/path/to/your/man_in_white_glasses.jpg")),
"image/jpeg")),
config);
for (Part part : response.parts()) {
if (part.text().isPresent()) {
System.out.println(part.text().get());
} else if (part.inlineData().isPresent()) {
var blob = part.inlineData().get();
if (blob.data().isPresent()) {
Files.write(Paths.get("man_right_profile.png"), blob.data().get());
}
}
}
}
}
}
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d "{
\"contents\": [{
\"parts\":[
{\"text\": \"A studio portrait of this man against white, in profile looking right\"},
{
\"inline_data\": {
\"mime_type\":\"image/jpeg\",
\"data\": \"<BASE64_IMAGE_DATA>\"
}
}
]
}]
}"
```


输入 |
输出内容 1 |
输出内容 2 |
![]() |
![]() |
![]() |

### 最佳做法

如需将效果从良好提升到出色，请将以下专业策略融入您的工作流程。

**具体化**：您提供的信息越详细，对输出结果的掌控程度就越高。与其使用“奇幻盔甲”，不如具体描述：“华丽的精灵板甲，蚀刻着银叶图案，带有高领和猎鹰翅膀形状的肩甲。”**提供上下文和意图**：说明图片的*用途*。模型对上下文的理解会影响最终输出。例如，“为高端极简护肤品牌设计徽标”的效果要好于“设计徽标”。**迭代和优化**：不要指望第一次尝试就能生成完美的图片。利用模型的对话特性进行小幅更改。使用后续提示，例如“这很棒，但你能让光线更暖一些吗？”或“保持所有内容不变，但让角色的表情更严肃一些。”**使用分步指令**：对于包含许多元素的复杂场景，请将提示拆分为多个步骤。“首先，创建一个宁静、薄雾弥漫的黎明森林的背景。然后，在前景中添加一个长满苔藓的古老石制祭坛。最后，将一把发光的剑放在祭坛顶部。”**使用“语义负面提示”**：不要说“没有汽车”，而是通过说“一条没有交通迹象的空旷、荒凉的街道”来正面描述所需的场景。**控制镜头**：使用摄影和电影语言来控制构图。例如`wide-angle shot`

、`macro shot`

、`low-angle perspective`

等字词。

## 限制

- 为获得最佳性能，请使用以下语言：英语、ar-EG、de-DE、es-MX、fr-FR、hi-IN、id-ID、it-IT、ja-JP、ko-KR、pt-BR、ru-RU、ua-UA、vi-VN、zh-CN。
- 图片生成不支持音频或视频输入。
- 模型不一定会严格按照用户明确要求的图片输出数量来生成图片。
`gemini-2.5-flash-image`

最多可接受 3 张图片作为输入，而`gemini-3-pro-image-preview`

可接受 5 张高保真图片，总共最多可接受 14 张图片。`gemini-3.1-flash-image-preview`

可在单一工作流中保持多达 4 个角色的相似度，并保持多达 10 个物体的细节保真度。- 为图片生成文字时，最好先生成文字，然后再要求生成包含该文字的图片，这样 Gemini 的效果最好。
- 所有生成的图片都包含
[SynthID 水印](https://ai.google.dev/responsible/docs/safeguards/synthid?hl=zh-cn)。

## 可选配置

您可以选择在 `generate_content`

调用的 `config`

字段中配置模型输出的响应模态和宽高比。

### 输出类型

默认情况下，模型会返回文本和图片响应（即 `response_modalities=['Text', 'Image']`

）。您可以使用 `response_modalities=['Image']`

将响应配置为仅返回图片而不返回文本。

### Python

```
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[prompt],
config=types.GenerateContentConfig(
response_modalities=['Image']
)
)
```


### JavaScript

```
const response = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
config: {
responseModalities: ['Image']
}
});
```


### Go

```
result, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("Create a picture of a nano banana dish in a " +
" fancy restaurant with a Gemini theme"),
&genai.GenerateContentConfig{
ResponseModalities: "Image",
},
)
```


### Java

```
response = client.models.generateContent(
"gemini-3.1-flash-image-preview",
prompt,
GenerateContentConfig.builder()
.responseModalities("IMAGE")
.build());
```


### REST

```
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H "Content-Type: application/json" \
-d '{
"contents": [{
"parts": [
{"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
]
}],
"generationConfig": {
"responseModalities": ["Image"]
}
}'
```


### 宽高比和图片大小

默认情况下，模型会使输出图片的大小与输入图片的大小相匹配，否则会生成 1:1 的正方形图片。您可以使用响应请求中 `image_config`

下的 `aspect_ratio`

字段来控制输出图片的宽高比，如下所示：

### Python

```
# For gemini-2.5-flash-image
response = client.models.generate_content(
model="gemini-2.5-flash-image",
contents=[prompt],
config=types.GenerateContentConfig(
image_config=types.ImageConfig(
aspect_ratio="16:9",
)
)
)
# For gemini-3.1-flash-image-preview and gemini-3-pro-image-preview
response = client.models.generate_content(
model="gemini-3.1-flash-image-preview",
contents=[prompt],
config=types.GenerateContentConfig(
image_config=types.ImageConfig(
aspect_ratio="16:9",
image_size="2K",
)
)
)
```


### JavaScript

```
// For gemini-2.5-flash-image
const response = await ai.models.generateContent({
model: "gemini-2.5-flash-image",
contents: prompt,
config: {
imageConfig: {
aspectRatio: "16:9",
},
}
});
// For gemini-3.1-flash-image-preview and gemini-3-pro-image-preview
const response_gemini3 = await ai.models.generateContent({
model: "gemini-3.1-flash-image-preview",
contents: prompt,
config: {
imageConfig: {
aspectRatio: "16:9",
imageSize: "2K",
},
}
});
```


### Go

```
// For gemini-2.5-flash-image
result, _ := client.Models.GenerateContent(
ctx,
"gemini-2.5-flash-image",
genai.Text("Create a picture of a nano banana dish in a " +
" fancy restaurant with a Gemini theme"),
&genai.GenerateContentConfig{
ImageConfig: &genai.ImageConfig{
AspectRatio: "16:9",
},
}
)
// For gemini-3.1-flash-image-preview and gemini-3-pro-image-preview
result_gemini3, _ := client.Models.GenerateContent(
ctx,
"gemini-3.1-flash-image-preview",
genai.Text("Create a picture of a nano banana dish in a " +
" fancy restaurant with a Gemini theme"),
&genai.GenerateContentConfig{
ImageConfig: &genai.ImageConfig{
AspectRatio: "16:9",
ImageSize: "2K",
},
}
)
```


### Java

```
// For gemini-2.5-flash-image
response = client.models.generateContent(
"gemini-2.5-flash-image",
prompt,
GenerateContentConfig.builder()
.imageConfig(ImageConfig.builder()
.aspectRatio("16:9")
.build())
.build());
// For gemini-3.1-flash-image-preview and gemini-3-pro-image-preview
response_gemini3 = client.models.generateContent(
"gemini-3.1-flash-image-preview",
prompt,
GenerateContentConfig.builder()
.imageConfig(ImageConfig.builder()
.aspectRatio("16:9")
.imageSize("2K")
.build())
.build());
```


### REST

```
# For gemini-2.5-flash-image
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
"contents": [{
"parts": [
{"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
]
}],
"generationConfig": {
"imageConfig": {
"aspectRatio": "16:9"
}
}
}'
# For gemini-3-pro-image-preview
curl -s -X POST \
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
-H "x-goog-api-key: $GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
"contents": [{
"parts": [
{"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
]
}],
"generationConfig": {
"imageConfig": {
"aspectRatio": "16:9",
"imageSize": "2K"
}
}
}'
```


下表列出了可用的不同宽高比以及生成的图片大小：

### 3.1 Flash 映像预览

| 宽高比 | 512 分辨率 | 500 个 token | 1K 分辨率 | 1,000 个词元 | 2K 分辨率 | 2,000 个 token | 4K 分辨率 | 4,000 个 token |
|---|---|---|---|---|---|---|---|---|
1:1 |
512x512 | 747 | 1024x1024 | 1120 | 2048 x 2048 | 1120 | 4096x4096 | 2000 |
1:4 |
256x1024 | 747 | 512x2048 | 1120 | 1024x4096 | 1120 | 2048x8192 | 2000 |
1:8 |
192x1536 | 747 | 384x3072 | 1120 | 768x6144 | 1120 | 1536x12288 | 2000 |
2:3 |
424x632 | 747 | 848x1264 | 1120 | 1696x2528 | 1120 | 3392x5056 | 2000 |
3:2 |
632x424 | 747 | 1264x848 | 1120 | 2528x1696 | 1120 | 5056x3392 | 2000 |
3:4 |
448x600 | 747 | 896x1200 | 1120 | 1792x2400 | 1120 | 3584x4800 | 2000 |
4:1 |
1024x256 | 747 | 2048x512 | 1120 | 4096x1024 | 1120 | 8192x2048 | 2000 |
4:3 |
600x448 | 747 | 1200x896 | 1120 | 2400x1792 | 1120 | 4800x3584 | 2000 |
4:5 |
464x576 | 747 | 928x1152 | 1120 | 1856x2304 | 1120 | 3712x4608 | 2000 |
5:4 |
576x464 | 747 | 1152x928 | 1120 | 2304x1856 | 1120 | 4608x3712 | 2000 |
8:1 |
1536x192 | 747 | 3072x384 | 1120 | 6144x768 | 1120 | 12288x1536 | 2000 |
9:16 |
384x688 | 747 | 768x1376 | 1120 | 1536x2752 | 1120 | 3072x5504 | 2000 |
16:9 |
688x384 | 747 | 1376x768 | 1120 | 2752x1536 | 1120 | 5504x3072 | 2000 |
21:9 |
792x168 | 747 | 1584x672 | 1120 | 3168x1344 | 1120 | 6336x2688 | 2000 |

### 3 Pro Image 预览版

| 宽高比 | 1K 分辨率 | 1,000 个词元 | 2K 分辨率 | 2,000 个 token | 4K 分辨率 | 4,000 个 token |
|---|---|---|---|---|---|---|
1:1 |
1024x1024 | 1120 | 2048 x 2048 | 1120 | 4096x4096 | 2000 |
2:3 |
848x1264 | 1120 | 1696x2528 | 1120 | 3392x5056 | 2000 |
3:2 |
1264x848 | 1120 | 2528x1696 | 1120 | 5056x3392 | 2000 |
3:4 |
896x1200 | 1120 | 1792x2400 | 1120 | 3584x4800 | 2000 |
4:3 |
1200x896 | 1120 | 2400x1792 | 1120 | 4800x3584 | 2000 |
4:5 |
928x1152 | 1120 | 1856x2304 | 1120 | 3712x4608 | 2000 |
5:4 |
1152x928 | 1120 | 2304x1856 | 1120 | 4608x3712 | 2000 |
9:16 |
768x1376 | 1120 | 1536x2752 | 1120 | 3072x5504 | 2000 |
16:9 |
1376x768 | 1120 | 2752x1536 | 1120 | 5504x3072 | 2000 |
21:9 |
1584x672 | 1120 | 3168x1344 | 1120 | 6336x2688 | 2000 |

### Gemini 2.5 Flash 图片

| 宽高比 | 分辨率 | 令牌 |
|---|---|---|
| 1:1 | 1024x1024 | 1290 |
| 2:3 | 832x1248 | 1290 |
| 3:2 | 1248x832 | 1290 |
| 3:4 | 864x1184 | 1290 |
| 4:3 | 1184x864 | 1290 |
| 4:5 | 896x1152 | 1290 |
| 5:4 | 1152x896 | 1290 |
| 9:16 | 768x1344 | 1290 |
| 16:9 | 1344x768 | 1290 |
| 21:9 | 1536x672 | 1290 |

## 模型选择

选择最适合您的特定使用场景的模型。

**Gemini 3.1 Flash Image 预览版（Nano Banana 2 预览版）**应该是您的首选图片生成模型，因为它在性能和智能方面表现出色，并且在成本和延迟方面实现了平衡。如需了解详情，请参阅模型[价格](https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#gemini-3.1-flash-image-preview)和[功能](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview?hl=zh-cn)页面。**Gemini 3 Pro Image 预览版（Nano Banana Pro 预览版）**专为专业资源制作和复杂指令而设计。此模型具有以下特点：使用 Google 搜索进行现实世界接地、默认的“思考”流程（可在生成之前优化构图），以及可生成分辨率高达 4K 的图片。如需了解详情，请参阅模型[价格](https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#gemini-3-pro-image-preview)和[功能](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview?hl=zh-cn)页面。**Gemini 2.5 Flash Image (Nano Banana)**旨在实现速度和效率。此模型经过优化，可处理大批量、低延迟的任务，并生成 1024 像素分辨率的图片。如需了解详情，请查看模型[价格](https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#gemini-2.5-flash-image)和[功能](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image?hl=zh-cn)页面。

### 何时使用 Imagen

除了使用 Gemini 的内置图片生成功能外，您还可以通过 Gemini API 访问我们专业的图片生成模型 [Imagen](https://ai.google.dev/gemini-api/docs/imagen?hl=zh-cn)。

如果您刚开始使用 Imagen 生成图片，Imagen 4 应该是您的首选模型。如果需要处理高级用例或需要最佳图片质量，请选择 Imagen 4 Ultra（请注意，该模型一次只能生成一张图片）。