import { Link } from 'react-router-dom';

export function NotFoundScreen() {
  return (
    <main className="placeholder-screen">
      <p className="eyebrow">Don't Like My Pets</p>
      <h1>Page not found</h1>
      <p>
        This address does not match any Petswap route. The link may be incomplete, or the page may
        have moved.
      </p>
      <p>
        <Link to="/">Back to search</Link>
      </p>
    </main>
  );
}
