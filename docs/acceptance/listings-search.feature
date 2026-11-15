Feature: Listings and search
  Hosts publish listings; visitors find them by place, keyword, pet type, capacity, and dates.

  # Requirement: FR-3.1
  # Verified by: supabase/tests/listing_rules.test.sql
  # Verified by: supabase/tests/listing_edit_rules.test.sql
  Scenario: A listing needs the required fields
    Given I am signed in
    When I save a listing without a title, location, description, capacity above zero, or accepted pet type
    Then it is not saved and the rest of my form is kept

  # Requirement: FR-3.1
  # Verified by: supabase/tests/listing_host_access.test.sql
  Scenario: A draft is private
    Given I saved a listing as a draft
    When another user or a visitor opens its address
    Then they cannot read it

  # Requirement: FR-3.1
  # Verified by: supabase/tests/listing_deletion.test.sql
  Scenario: A listing with active bookings cannot be deleted
    Given my listing has a pending or confirmed booking
    When I delete it
    Then the deletion is rejected with an explanation

  # Requirement: FR-4.1
  # Verified by: supabase/tests/listing_search.test.sql
  Scenario: An empty search shows everything published
    Given several published listings exist
    When I search with no criteria
    Then I see all of them, newest first

  # Requirement: FR-4.1
  # Verified by: web/src/features/search/components/SearchScreen.integration.test.tsx
  Scenario: No match shows an empty state
    When I search for a place nobody lists
    Then I see a clear "no results" state

  # Requirement: FR-4.2
  # Verified by: supabase/tests/listing_search_filters.test.sql
  Scenario: Filters combine and respect availability
    Given a listing has a confirmed booking from 1 to 5 February
    When I search with pet type, minimum capacity, and the dates 2 to 4 February
    Then that listing is not in the results
    But a listing that is free for those dates and fits is
