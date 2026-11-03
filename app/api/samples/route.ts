import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const samplesDir = path.join(process.cwd(), 'samples')
    const files = fs.readdirSync(samplesDir)
    const samples: Record<string, { id: string; name: string; domain: string; text: string }> = {}

    for (const f of files) {
      if (f.endsWith('.txt')) {
        const id = f.replace('.txt', '')
        const fullPath = path.join(samplesDir, f)
        const text = fs.readFileSync(fullPath, 'utf-8').trim()
        const domain = f.includes('earning') || f.includes('memo') ? 'financial' : f.includes('contract') ? 'legal' : 'general'
        const name = id.replace(/^\d+_/, '').replace(/_/g, ' ').toUpperCase()
        samples[id] = { id, name, domain, text }
      }
    }

    return NextResponse.json(samples)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
