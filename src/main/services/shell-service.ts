import { shell } from 'electron'
import { VeloxError } from '../shared/errors'

const allowedExternalProtocols = new Set(['https:', 'mailto:'])

export class ShellService {
  async openExternal(url: string): Promise<void> {
    const parsedUrl = new URL(url)

    if (!allowedExternalProtocols.has(parsedUrl.protocol)) {
      throw new VeloxError('UNSUPPORTED_EXTERNAL_PROTOCOL', 'Unsupported external URL protocol', {
        protocol: parsedUrl.protocol
      })
    }

    await shell.openExternal(url)
  }

  showItemInFolder(path: string): void {
    shell.showItemInFolder(path)
  }
}
