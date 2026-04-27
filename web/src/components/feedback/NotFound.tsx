import { Link } from 'react-router';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="text-4xl font-semibold">404 — page not found</h1>
      <p className="text-slate-400">That page is not part of HireWire.</p>
      <Link
        to="/"
        className="rounded-md bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
      >
        Go home
      </Link>
    </main>
  );
}
