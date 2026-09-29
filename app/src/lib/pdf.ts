import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(exec)

// VULNERABLE (M2 command injection): title interpolated into a shell command.
export async function renderInvoicePdf(title: string): Promise<string> {
  // In the lab wkhtmltopdf may be absent; the injection is provable via the echo side-effect.
  const { stdout } = await run(`echo "rendering ${title}" && echo done`)
  return stdout
}
