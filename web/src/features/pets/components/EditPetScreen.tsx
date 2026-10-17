import { ArrowLeft, PawPrint } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePet, usePetPhotoUrl, useUpdatePet } from '../hooks/usePets';
import type { Pet, UpdatePetValues } from '../lib/petApi';
import { petToFormValues } from '../lib/petForm';
import { PetForm } from './PetForm';

function EditPetForm({ pet }: { pet: Pet }) {
  const navigate = useNavigate();
  const updatePetMutation = useUpdatePet();
  const { data: savedPhotoUrl } = usePetPhotoUrl(pet.photo_url);

  const handleSubmit = async (values: UpdatePetValues) => {
    try {
      // PetForm adds photo or removePhoto only when the owner changed the photo, so an
      // untouched picker keeps the stored photo.
      await updatePetMutation.mutateAsync({ petId: pet.id, values });
      // replace, so browser Back from My Pets does not reopen the form that was just saved.
      void navigate('/pets', { replace: true, state: { petSaved: true } });
    } catch {
      // The mutation's error state renders the message.
    }
  };

  return (
    <PetForm
      initialValues={petToFormValues(pet)}
      hasSavedPhoto={Boolean(pet.photo_url)}
      savedPhotoUrl={savedPhotoUrl}
      submitLabel="Save changes"
      pendingLabel="Saving changes..."
      isSubmitting={updatePetMutation.isPending}
      submitError={updatePetMutation.isError
        ? 'We could not save your changes. Check your connection and try again.'
        : null}
      onSubmit={(values) => { void handleSubmit(values); }}
      onCancel={() => { void navigate('/pets'); }}
      onEdit={() => { if (updatePetMutation.isError) updatePetMutation.reset(); }}
    />
  );
}

export function EditPetScreen() {
  const { petId = '' } = useParams();
  // usePet returns null for a missing pet, a malformed id, and a pet the user can only read
  // through a booking, so all three are the same "not found" state.
  const { data: pet, isPending, isError } = usePet(petId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/pets">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my pets
        </Link>
        <div className="mb-6 mt-4">
          <p className="mb-1 text-xs font-bold uppercase text-brand-700">Pet profiles</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Edit pet</h1>
        </div>

        {isPending && (
          <div className="min-h-96 animate-pulse rounded-lg border border-gray-100 bg-gray-200" aria-label="Loading pet" aria-busy="true" />
        )}

        {/* A failed background refetch keeps the loaded pet, so the error only replaces the form when there is none. */}
        {isError && !pet && (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
            <PawPrint className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not load your pet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection, then refresh the page.</p>
          </section>
        )}

        {!isPending && !isError && !pet && (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <PawPrint className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Pet not found</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">It may have been deleted, or it belongs to someone else.</p>
            <Link className="btn-secondary mt-4" to="/pets">Back to my pets</Link>
          </section>
        )}

        {pet && <EditPetForm key={pet.id} pet={pet} />}
      </main>
    </div>
  );
}
