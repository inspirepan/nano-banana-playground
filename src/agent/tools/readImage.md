Read an image by image_id.

Omit offset or pass offset <= 0 the first time to receive image metadata, generation context, prompt lines, and the image content.

Pass offset > 0 to read only additional prompt lines without sending the image again.
