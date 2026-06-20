import type { ImageEditRequest, ImageGenerationRequest, ImageResult } from '@ai-canvas/shared'

export interface ImageAdapter {
  generateImage(request: ImageGenerationRequest): Promise<ImageResult>
  editImage(request: ImageEditRequest): Promise<ImageResult>
}

export class ExternalCodexImage20Adapter implements ImageAdapter {
  async generateImage(_request: ImageGenerationRequest): Promise<ImageResult> {
    throw new Error(
      'Codex image 2.0 generation is invoked by Codex itself. Generate an image in Codex, save it locally, then call insert_image_into_holder.'
    )
  }

  async editImage(_request: ImageEditRequest): Promise<ImageResult> {
    throw new Error(
      'Codex image 2.0 editing is invoked by Codex itself. Edit the image in Codex, save it locally, then call create_image_version.'
    )
  }
}
