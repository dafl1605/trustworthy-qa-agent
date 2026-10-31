import { useEffect, useRef, useState } from 'react';
import { SHELL_VIEWS, resolveShellView, type ShellViewId } from './shell-model.js';

export function App() {
  const [viewId, setViewId] = useState<ShellViewId>('catalog');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const section = resolveShellView(viewId);

  useEffect(() => {
    if (!focusHeading.current) {
      return;
    }
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [viewId]);

  function showSection(id: ShellViewId) {
    focusHeading.current = true;
    setViewId(id);
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header>
        <p className="eyebrow">Demo store</p>
        <h1>Trustworthy QA Storefront</h1>
        <nav aria-label="Store sections">
          <ul className="section-nav">
            {SHELL_VIEWS.map((view) => {
              const selected = view.id === section.id;
              return (
                <li key={view.id}>
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    aria-controls="store-section"
                    onClick={() => {
                      showSection(view.id);
                    }}
                  >
                    {view.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <section id="store-section" aria-labelledby="section-heading">
          <h2 id="section-heading" ref={headingRef} tabIndex={-1}>
            {section.heading}
          </h2>
          <p>{section.body}</p>
        </section>
        <p role="status">{section.status}</p>
        <p className="note">A message on this page is not proof that an order was saved.</p>
      </main>
    </div>
  );
}
