import experiments from './experiments.json'

export default function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>WebPlayground</h1>
      {experiments.length === 0 ? (
        <p>No experiments yet.</p>
      ) : (
        <ul>
          {experiments.map(({ slug, name, description }) => (
            <li key={slug}>
              <a href={`${import.meta.env.BASE_URL}experiments/${slug}/`}>{name}</a>
              {description && <span> — {description}</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
