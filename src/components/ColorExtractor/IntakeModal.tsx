import { FileUploadDropzone, LoadingIndicator, Modal, Text } from '@create-figma-plugin/ui'
import { useEffect } from 'preact/hooks'
import { useExtractorStore } from '@/store/extractor'
import { imageFromFile, imageFromUrl } from '@/utils/image'
import type { DecodedImage } from '@/utils/image'
import styles from './IntakeModal.css'

// Decode a source into the store: spinner while it runs, workspace on success,
// back to the modal with a message on failure. Reads the store via getState so
// it needs no closure over component state (safe to call from a paste handler).
async function runDecode(decode: () => Promise<DecodedImage>) {
  const store = useExtractorStore.getState()
  store.startLoading()
  try {
    store.setSource(await decode())
  } catch (error) {
    store.fail(error instanceof Error ? error.message : 'Couldn’t load that image.')
  }
}

// Intake step: an overlay modal accepting an image by drag-drop, click-to-upload,
// or a clipboard paste (image bytes or a link) while it's open. Once a source
// decodes, the store flips to the full-area workspace.
export function IntakeModal() {
  const stage = useExtractorStore((s) => s.stage)
  const error = useExtractorStore((s) => s.error)
  const close = useExtractorStore((s) => s.close)

  const open = stage === 'intake' || stage === 'loading'
  const loading = stage === 'loading'

  // Accept a pasted image or link for as long as the modal is mounted. The paste
  // event carries either image bytes (no CORS) or text — a URL we try to fetch.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const data = event.clipboardData
      if (data === null) return
      const file = Array.from(data.files).find((f) => f.type.startsWith('image/'))
      if (file !== undefined) {
        event.preventDefault()
        void runDecode(() => imageFromFile(file))
        return
      }
      const text = data.getData('text').trim()
      if (text !== '') {
        event.preventDefault()
        void runDecode(() => imageFromUrl(text))
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function handleFiles(files: Array<File>) {
    const file = files[0]
    if (file !== undefined) void runDecode(() => imageFromFile(file))
  }

  return (
    <Modal
      open={open}
      title="Extract colors from image"
      onCloseButtonClick={close}
      onEscapeKeyDown={close}
      onOverlayClick={close}
      style={{ borderRadius: '12px' }}
    >
      <div class={styles.body}>
        {loading ? (
          <div class={styles.loading}>
            <LoadingIndicator />
          </div>
        ) : (
          <>
            {/* No acceptedFileTypes: the DS reuses it as an exact-MIME filter
                ('image/*' matches nothing, dropping every file silently), so we
                accept all files and let decodeBlob reject non-images. */}
            <FileUploadDropzone onSelectedFiles={handleFiles}>
              <Text align="center">
                Drag an image here, paste from clipboard,
                <br />
                or <strong>click to upload</strong>
              </Text>
            </FileUploadDropzone>

            {error !== null && <div class={styles.error}>{error}</div>}
          </>
        )}
      </div>
    </Modal>
  )
}
