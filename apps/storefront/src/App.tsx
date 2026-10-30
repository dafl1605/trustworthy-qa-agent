/**
 * QA-01 scaffold only — catalog, cart, and checkout land in QA-03/QA-04.
 */
export function App() {
  return (
    <main className="app-shell">
      <header>
        <h1>Trustworthy QA Demo Store</h1>
        <p className="tagline">
          Scaffolding placeholder for the BrowserStack meetup checkout demo.
        </p>
      </header>
      <section aria-labelledby="status-heading">
        <h2 id="status-heading">Project status</h2>
        <p>
          Storefront UI, API checkout routes, and fault injection are not
          implemented in QA-01. Shared contracts and workspace layout are in
          place for downstream tasks.
        </p>
      </section>
    </main>
  );
}
