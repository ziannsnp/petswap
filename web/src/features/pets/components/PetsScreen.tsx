import { useEffect, useState } from 'react';
import { PawPrint, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMyPets } from '../hooks/usePets';
import { PetCard } from './PetCard';

export function PetsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: pets, isPending, isError } = useMyPets();
  // Read once, then cleared from the history entry, so a refresh does not confirm the save again.
  const [petSaved] = useState(location.state?.petSaved === true);

  useEffect(() => {
    if (location.state?.petSaved) void navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="page-container">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-brand-700">Pet profiles</p>
            <h1 className="text-2xl font-bold sm:text-3xl">My pets</h1>
          </div>
          <Link className="btn-primary flex min-h-11 items-center justify-center gap-2" to="/pets/new">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Add pet</span>
            <span className="sr-only sm:hidden">Add pet</span>
          </Link>
        </div>

        {petSaved && (
          <p className="mb-6 border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            Pet saved successfully.
          </p>
        )}

        {isPending && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading pets" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div className="min-h-32 animate-pulse rounded-lg border border-gray-100 bg-gray-200" key={item} />
            ))}
          </div>
        )}

        {/* A failed background refetch keeps the loaded pets, so the error only replaces the list
            when there is none. Otherwise a failed delete would unmount the card, and with it the
            dialog that explains the failure. */}
        {isError && !pets && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
            <PawPrint className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not load your pets</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection and Supabase environment, then refresh the page.</p>
          </section>
        )}

        {pets?.length === 0 && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <PawPrint className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No pets yet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Add a pet profile so you can request care for your pet.</p>
            <Link className="btn-secondary mt-4" to="/pets/new">Add your first pet</Link>
          </section>
        )}

        {pets && pets.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
          </div>
        )}
      </main>
    </div>
  );
}
