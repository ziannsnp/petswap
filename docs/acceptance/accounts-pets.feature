Feature: Accounts and pets

  # Requirement: FR-1.1
  # Verified by: web/src/features/auth/components/RegisterScreen.test.tsx
  Scenario: Registration enforces the password policy
    Given I am on the registration page
    When I enter a password without an uppercase letter, a digit, or a special character
    Then I am told what is missing and no account is created

  # Requirement: FR-1.1
  # Verified by: web/src/features/auth/components/ProtectedRoute.test.tsx
  Scenario: Protected pages need a session
    Given I am signed out
    When I open my pets page
    Then I am sent to the login page

  # Requirement: FR-2.1
  # Verified by: supabase/tests/pet_rules.test.sql
  Scenario: Only the owner edits a pet
    Given a pet belongs to another user
    When I try to edit it
    Then nothing changes

  # Requirement: FR-2.1
  # Verified by: supabase/tests/pet_rules.test.sql
  Scenario: A pet with active bookings cannot be deleted
    Given my pet has a pending or confirmed booking
    When I delete it
    Then the deletion is rejected and the pet remains
