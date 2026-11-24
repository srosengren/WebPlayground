import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

export function collectExperiments(experimentsDir) {
  if (!existsSync(experimentsDir)) return []

  return readdirSync(experimentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .flatMap(d => {
      const slug = d.name
      const pkgPath = join(experimentsDir, slug, 'package.json')
      if (!existsSync(pkgPath)) return []
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      return [{ slug, name: pkg.name ?? slug, description: pkg.description ?? '' }]
    })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const experiments = collectExperiments(join(root, 'experiments'))
  writeFileSync(join(root, 'src', 'experiments.json'), JSON.stringify(experiments, null, 2) + '\n')
  console.log(`Wrote ${experiments.length} experiment(s) to src/experiments.json`)
}
