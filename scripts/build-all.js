import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { collectExperiments } from './collect-experiments.js'

const root = fileURLToPath(new URL('..', import.meta.url))

const experiments = collectExperiments(join(root, 'experiments'))
writeFileSync(join(root, 'src', 'experiments.json'), JSON.stringify(experiments, null, 2) + '\n')
console.log(`Collected ${experiments.length} experiment(s)`)

execSync(join(root, 'node_modules', '.bin', 'vite') + ' build', { stdio: 'inherit', cwd: root })

for (const { slug } of experiments) {
  const expDir = join(root, 'experiments', slug)
  if (!existsSync(join(expDir, 'package.json'))) continue
  execSync(`npm run build -w ./experiments/${slug}`, { stdio: 'inherit', cwd: root })
  cpSync(join(expDir, 'dist'), join(root, 'dist', 'experiments', slug), { recursive: true })
  console.log(`Copied experiments/${slug}/dist → dist/experiments/${slug}`)
}
