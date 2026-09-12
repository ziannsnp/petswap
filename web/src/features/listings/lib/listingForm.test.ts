import { validateListingForm } from './listingForm';
import { invalidListingFormCases, validListingFormValues } from '../testing/listingFixtures';

describe('validateListingForm', () => {
  it('accepts a complete listing form', () => {
    expect(
      validateListingForm(validListingFormValues),
    ).toEqual({});
  });

  it.each(invalidListingFormCases)('reports errors for $name', ({ values, expectedErrors }) => {
    expect(validateListingForm(values)).toEqual(expectedErrors);
  });
});
