export class ExternalCodexImage20Adapter {
    async generateImage(_request) {
        throw new Error('Codex image 2.0 generation is invoked by Codex itself. Generate an image in Codex, save it locally, then call insert_image_into_holder.');
    }
    async editImage(_request) {
        throw new Error('Codex image 2.0 editing is invoked by Codex itself. Edit the image in Codex, save it locally, then call create_image_version.');
    }
}
