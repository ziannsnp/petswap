import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreatePet } from '../hooks/usePets';
import type { CreatePetValues } from '../lib/petApi';
import { PetForm } from './PetForm';

export function CreatePetScreen() {
  const navigate = useNavigate();
  const createPetMutation = useCreatePet();

  const handleSubmit = async (values: CreatePetValues) => {
    try {
      await createPetMutation.mutateAsync(values);
      void navigate('/pets', { state: { petSaved: true } });
    } catch {
      // The mutation's error state renders the message.
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/pets">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my pets
        </Link>
        <div className="mb-6 mt-4">
          <p className="mb-1 text-xs font-bold uppercase text-brand-700">Pet profiles</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Add a pet</h1>
        </div>

        <PetForm
          submitLabel="Save pet"
          pendingLabel="Saving..."
          isSubmitting={createPetMutation.isPending}
          submitError={createPetMutation.isError
            ? 'We could not save your pet. Check your connection and try again.'
            : null}
          onSubmit={(values) => { void handleSubmit(values); }}
          onCancel={() => { void navigate('/pets'); }}
          onEdit={() => { if (createPetMutation.isError) createPetMutation.reset(); }}
        />
      </main>
    </div>
  );
}
