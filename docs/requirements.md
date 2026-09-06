# Functional requirements

## Overview

Don't Like My Pets is a community pet-sitting marketplace connecting pet owners with people who offer in-home pet care. A user may own pets, create a place listing, and request pet-sitting services—there are no fixed user roles.

The platform focuses on discovering sitters, creating booking requests, and preventing overlapping confirmed bookings. It does not handle payments, identity-document verification, messaging, availability toggles, or ratings.

## Accounts and profiles

### FR-1.1 Registration and login

Users can register, log in, and log out with Supabase Authentication. Registration requires a valid unique email, a unique username, and an ASCII password of at least eight characters containing at least one lowercase English letter, uppercase English letter, number, and special character, with no spaces. A username contains 3–30 lowercase letters, numbers, or underscores; uppercase input is normalized to lowercase. Users can log in with either their email or username and password. Invalid credentials, used emails, used usernames, and network failures show safe errors without exposing private account data. Protected pages require authentication.

### FR-1.2 Profile management

Logged-in users can view and edit their own display name, profile photo, phone number, and location. Required fields cannot be empty, changes remain after refresh, and users cannot edit another profile.

## Pet profiles

### FR-2.1 Pet management

Users can create, view, edit, and delete only their own pet profiles. A pet includes name, species, breed, age, photo, and description; missing required fields block submission.

### FR-2.2 Pet care information

Users can add or edit their own pets' feeding instructions, medical notes, behaviour notes, allergies, vaccination information, and other special requirements. Optional fields may be blank. Care information is visible when the pet is included in a booking request.

## Listings and search

### FR-3.1 Listing management

Users can create, view, edit, and delete listings where they can care for pets. A listing includes title, location, description, capacity, accepted pet types, photos, and plain-text facilities. Title, location, description, and capacity are required; published listings are publicly viewable.

### FR-3.2 Listing details

Selecting a published listing opens its detail page with host profile, facilities, capacity, accepted pet types, photos, and description. Deleted listings are unavailable in search and direct access.

### FR-4.1 Search listings

Users can search published listings by location or keyword. An empty search displays all published listings, while no matching listings clearly shows an empty state.

### FR-4.2 Filter listings

Users can combine accepted pet type, capacity, and requested-date filters. Results exclude listings with insufficient capacity or a confirmed booking overlapping the requested dates.

## Booking management

### FR-5.1 Create a booking request

Users can request a booking for one of their pets at another user's listing with a start and end date. End date must be later than start date, required fields must be present, and new requests are `Pending`.

### FR-5.2 Prevent double bookings

Confirmed bookings for the same listing cannot overlap. Pending, declined, and cancelled requests do not block dates; back-to-back bookings are allowed.

### FR-5.3 View booking requests

Users can view outgoing bookings for their pets and incoming bookings for their listings. Each shows pet, listing, dates, and status. Unrelated users cannot access a booking.

### FR-5.4 Manage booking status

Listing owners can confirm or decline pending requests. Requesters can cancel their pending or confirmed bookings. Listing owners can complete confirmed bookings after the end date. Valid transitions are:

```
Pending   → Confirmed | Declined | Cancelled
Confirmed → Completed | Cancelled
```

Confirming a booking repeats the double-booking check.

## Out of scope

- Payments, deposits, pricing, and paid services
- In-app messaging or chat
- Identity verification and admin approval workflows
- Manual availability toggles or calendar management
- Ratings, reviews, and average scores
- Automated vaccination-expiry reminders
