Feature: Booking requests and their lifecycle
  As a user who owns a pet, I can request a stay at another user's listing,
  and as a host I can confirm it, so that confirmed stays fit my listing's capacity
  and no pet is booked in two places at once.

  # Requirement: FR-5.1
  # Verified by: web/e2e/booking-flow.spec.ts
  # Verified by: supabase/tests/booking_rules.test.sql
  Scenario: A requester asks for a stay
    Given I am signed in and own a pet
    And a published listing belongs to another user
    When I request the listing for my pet with an end date later than the start date
    Then the booking is created with status "pending"

  # Requirement: FR-5.1
  # Verified by: web/src/features/bookings/lib/bookingRequestForm.test.ts
  # Verified by: supabase/tests/booking_lifecycle.test.sql
  Scenario Outline: An invalid request is rejected
    Given I am signed in and own a pet
    When I request a booking where <problem>
    Then no booking is created
    And I see a message that does not expose private data

    Examples:
      | problem                                  |
      | the end date is not later than the start |
      | the start date is in the past            |
      | the listing is my own                    |
      | the pet is not mine                      |

  # Requirement: FR-5.2
  # Verified by: web/e2e/booking-conflict-and-capacity.spec.ts
  # Verified by: supabase/tests/booking_capacity.test.sql
  # Verified by: supabase/tests/booking_concurrency.test.py
  Scenario: Confirmed stays cannot exceed the listing's capacity
    Given a listing with capacity 2 has a confirmed booking from 1 to 5 February
    And two other pets have pending bookings for the same listing from 3 to 7 February
    When the host confirms both pending bookings, even at the same moment
    Then exactly one of them is confirmed
    And the other stays "pending" with a message that the listing is full

  # Requirement: FR-5.2
  # Verified by: web/e2e/booking-conflict-and-capacity.spec.ts
  # Verified by: supabase/tests/booking_capacity.test.sql
  # Verified by: supabase/tests/booking_concurrency.test.py
  Scenario: A pet cannot be confirmed at two listings for the same nights
    Given my pet has a confirmed booking at one listing from 1 to 5 February
    And my pet has a pending booking at another listing from 3 to 7 February
    When the second host confirms it
    Then the confirmation is rejected without revealing the other booking
    And the second booking stays "pending"

  # Requirement: FR-5.2
  # Verified by: supabase/tests/booking_cancellation_release.test.sql
  Scenario: Cancelling a confirmed stay frees its place and its pet
    Given a listing with capacity 1 has a confirmed booking from 1 to 5 February
    And another pet has a pending booking for the same listing from 3 to 7 February
    When the requester of the confirmed booking cancels it
    And the host confirms the pending booking
    Then it is confirmed

  # Requirement: FR-5.2
  # Verified by: web/e2e/booking-conflict-and-capacity.spec.ts
  # Verified by: supabase/tests/booking_rules.test.sql
  # Verified by: supabase/tests/booking_capacity.test.sql
  Scenario: Back-to-back stays are allowed
    Given a listing has a confirmed booking from 1 to 5 February
    When the host confirms another booking from 5 to 9 February
    Then both bookings are confirmed

  # Requirement: FR-5.3
  # Verified by: supabase/tests/booking_lifecycle.test.sql
  Scenario: Only the people involved can see a booking
    Given a booking between a requester and a host
    When an unrelated signed-in user lists bookings
    Then the booking is not in the result

  # Requirement: FR-5.4
  # Verified by: web/e2e/booking-lifecycle.spec.ts
  Scenario: The host declines a request
    Given a pending booking at my listing
    When I decline it
    Then its status is "declined"
    And it no longer blocks any dates

  # Requirement: FR-5.4
  # Verified by: web/e2e/booking-lifecycle.spec.ts
  Scenario: The requester cancels
    Given my booking is "pending" or "confirmed"
    When I cancel it
    Then its status is "cancelled"

  # Requirement: FR-5.4
  # Verified by: web/src/features/bookings/lib/bookingRules.test.ts
  # Verified by: supabase/tests/booking_lifecycle.test.sql
  Scenario: A stay can be completed only after it ends
    Given a confirmed booking whose end date has not been reached
    When the host tries to complete it
    Then it is rejected
    But once the end date has been reached the host can complete it
